package com.longcon.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.longcon.core.TacticsContract

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ScaffoldScreen()
                }
            }
        }
    }
}

/**
 * M0 scaffold: no Firebase and no model call yet. It proves the Android app can read
 * the same contracts/tactics.json as the TypeScript core, with nothing duplicated here.
 */
@Composable
private fun ScaffoldScreen() {
    val context = LocalContext.current
    var status by remember { mutableStateOf("Loading shared contract…") }

    LaunchedEffect(Unit) {
        status = runCatching {
            val json = context.assets.open("tactics.json").bufferedReader().use { it.readText() }
            val contract = TacticsContract.parse(json)
            buildString {
                appendLine("Shared contract v${contract.version}")
                appendLine("${contract.tactics.size} tactics · ${contract.stages.size} stages")
                append("checkAt ${contract.riskConfig.checkAt.toInt()} · ")
                append("escalateAt ${contract.riskConfig.escalateAt.toInt()}")
            }
        }.getOrElse { error ->
            "Contract failed to load: ${error.message}"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Longcon", style = MaterialTheme.typography.headlineLarge)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Android scaffold — no Firebase yet", style = MaterialTheme.typography.bodyMedium)
        Spacer(modifier = Modifier.height(24.dp))
        Text(status, style = MaterialTheme.typography.bodyLarge)
    }
}
