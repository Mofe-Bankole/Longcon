package com.longcon.core

import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/**
 * Finds the repo's real contracts directory by walking up from the Gradle working
 * directory. Tests read the vectors in place: they are never copied or edited.
 */
object RepoPaths {

    fun contractsDir(): Path {
        var dir: Path? = Paths.get("").toAbsolutePath().normalize()
        while (dir != null) {
            val candidate = dir.resolve("contracts")
            if (Files.isDirectory(candidate.resolve("vectors"))) return candidate
            dir = dir.parent
        }
        error("Could not find contracts/vectors above ${Paths.get("").toAbsolutePath()}")
    }

    fun readText(relative: String): String =
        Files.readString(contractsDir().resolve(relative), StandardCharsets.UTF_8)

    fun json(relative: String): JsonElement =
        Json.parseToJsonElement(readText(relative))
}
