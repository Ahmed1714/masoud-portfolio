package com.englishapp.learning.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.englishapp.learning.ui.theme.*
import com.englishapp.learning.ui.viewmodels.ProgressViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgressScreen(
    onBack: () -> Unit,
    viewModel: ProgressViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Progress", color = TextPrimary, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = InkMedium)
            )
        },
        containerColor = InkDark
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = InkSurface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("Vocabulary mastered", color = TextSecondary, style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { state.masteredFraction },
                        modifier = Modifier.fillMaxWidth().height(10.dp).padding(vertical = 2.dp),
                        color = Correct,
                        trackColor = InkCard
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "${state.masteredCount} / ${state.totalWords} words",
                        color = TextPrimary,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }

            Spacer(Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                StatusCard(modifier = Modifier.weight(1f), label = "New", value = state.newCount, color = NewBadge)
                StatusCard(modifier = Modifier.weight(1f), label = "Learning", value = state.learningCount, color = LearningBadge)
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                StatusCard(modifier = Modifier.weight(1f), label = "Reviewing", value = state.reviewingCount, color = ReviewBadge)
                StatusCard(modifier = Modifier.weight(1f), label = "Mastered", value = state.masteredCount, color = MasteredBadge)
            }

            Spacer(Modifier.height(16.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = InkSurface),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Overall accuracy", color = TextSecondary, style = MaterialTheme.typography.labelMedium)
                        Text(
                            "${state.accuracyPercent}%",
                            color = Amber,
                            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("${state.totalCorrect} correct", color = Correct, style = MaterialTheme.typography.bodyMedium)
                        Text("${state.totalWrong} missed", color = Wrong, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusCard(modifier: Modifier, label: String, value: Int, color: androidx.compose.ui.graphics.Color) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = InkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(value.toString(), color = color, style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold))
            Text(label, color = TextSecondary, style = MaterialTheme.typography.labelMedium)
        }
    }
}
