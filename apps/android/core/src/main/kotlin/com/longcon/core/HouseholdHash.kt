package com.longcon.core

import java.security.SecureRandom
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Contact hashing for the household (architecture §2.4).
 *
 * cHash = hex(HMAC-SHA256(householdSecret, normaliseHandle(handle)))
 *
 * The secret is shared device-to-device at pairing and never stored in Firestore.
 * Kotlin must produce byte-identical output to packages/core/src/hash.ts; see
 * contracts/vectors/hash.json.
 */
object HandleNormaliser {

    private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    private val PHONE_CHARS = Regex("^\\+?[\\d\\s().-]+$")
    private val LEADING_AT = Regex("^@+")
    private val WHITESPACE = Regex("\\s+")
    private val DIGIT = Regex("\\d")

    fun normalise(raw: String): String {
        val s = raw.trim().lowercase()
        if (EMAIL.matches(s)) return "email:$s"
        val digits = DIGIT.findAll(s).count()
        if (PHONE_CHARS.matches(s) && digits >= 7) {
            val plus = if (s.startsWith("+")) "+" else ""
            val onlyDigits = s.filter { it.isDigit() }
            return "phone:$plus$onlyDigits"
        }
        val handle = s.replace(LEADING_AT, "").replace(WHITESPACE, " ")
        return "handle:$handle"
    }
}

class HouseholdHasher(secretHex: String) {

    private val secret: ByteArray = hexToBytes(secretHex)

    fun hash(handle: String): String = hashNormalised(HandleNormaliser.normalise(handle))

    fun hashNormalised(normalised: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret, "HmacSHA256"))
        return mac.doFinal(normalised.toByteArray(Charsets.UTF_8)).toHex()
    }

    private companion object {
        private val HEX = Regex("^([0-9a-fA-F]{2})+$")

        fun hexToBytes(hex: String): ByteArray {
            require(HEX.matches(hex)) { "household secret must be hex" }
            return ByteArray(hex.length / 2) { i ->
                hex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
            }
        }
    }
}

/** 32 random bytes, hex. Generated once by the first device, shared by QR. */
fun newHouseholdSecret(): String {
    val bytes = ByteArray(32)
    SecureRandom().nextBytes(bytes)
    return bytes.toHex()
}

private fun ByteArray.toHex(): String =
    joinToString(separator = "") { byte -> (byte.toInt() and 0xff).toString(16).padStart(2, '0') }
