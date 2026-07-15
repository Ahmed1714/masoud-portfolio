package com.englishapp.learning.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.englishapp.learning.data.repository.ReviewQuality
import com.englishapp.learning.ui.theme.*
import com.englishapp.learning.ui.viewmodels.FlashcardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FlashcardScreen(
    isReviewSession: Boolean,
    category: String?,
    onBack: () -> Unit,
    viewModel: FlashcardViewModel = hiltViewModel()
) {
    LaunchedEffect(isReviewSession, category) {
        if (isReviewSession) viewModel.loadReviewSession() else viewModel.loadCategorySession(category ?: "")
    }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isReviewSession) "Review" else category ?: "Flashcards", color = TextPrimary, fontWeight = FontWeight.Bold) },
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
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when {
                state.words.isEmpty() -> EmptyState(isReviewSession)
                state.isComplete -> SessionSummary(
                    correct = state.correctCount,
                    total = state.totalReviewed,
                    onDone = onBack
                )
                else -> {
                    LinearProgressIndicator(
                        progress = { state.progressFraction },
                        modifier = Modifier.fillMaxWidth(),
                        color = TealLight,
                        trackColor = InkSurface
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "${state.totalReviewed + 1} / ${state.words.size}",
                        color = TextSecondary,
                        style = MaterialTheme.typography.labelMedium
                    )
                    Spacer(Modifier.height(24.dp))

                    val word = state.currentWord
                    if (word != null) {
                        Card(
                            onClick = viewModel::flip,
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            colors = CardDefaults.cardColors(containerColor = InkSurface),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Column(
                                modifier = Modifier.fillMaxSize().padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = word.english,
                                    style = MaterialTheme.typography.displayMedium.copy(color = TextPrimary, fontWeight = FontWeight.Bold),
                                    textAlign = TextAlign.Center
                                )
                                if (state.isFlipped) {
                                    Spacer(Modifier.height(20.dp))
                                    Text(
                                        text = word.translation,
                                        style = MaterialTheme.typography.headlineMedium.copy(color = Amber, fontWeight = FontWeight.Bold),
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(Modifier.height(12.dp))
                                    Text(
                                        text = word.exampleSentence,
                                        style = MaterialTheme.typography.bodyLarge.copy(color = TextSecondary),
                                        textAlign = TextAlign.Center
                                    )
                                } else {
                                    Spacer(Modifier.height(20.dp))
                                    Icon(Icons.Default.TouchApp, null, tint = TextHint)
                                    Text("Tap to reveal", color = TextHint, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }

                        Spacer(Modifier.height(16.dp))

                        if (state.isFlipped) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                AnswerButton("Again", Wrong, Modifier.weight(1f)) { viewModel.submitAnswer(ReviewQuality.AGAIN) }
                                AnswerButton("Hard", Hard, Modifier.weight(1f)) { viewModel.submitAnswer(ReviewQuality.HARD) }
                                AnswerButton("Good", TealLight, Modifier.weight(1f)) { viewModel.submitAnswer(ReviewQuality.GOOD) }
                                AnswerButton("Easy", Correct, Modifier.weight(1f)) { viewModel.submitAnswer(ReviewQuality.EASY) }
                            }
                        } else {
                            Button(
                                onClick = viewModel::flip,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = TealMedium)
                            ) {
                                Text("Show answer")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnswerButton(label: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.buttonColors(containerColor = color),
        contentPadding = PaddingValues(vertical = 12.dp)
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, maxLines = 1)
    }
}

@Composable
private fun EmptyState(isReviewSession: Boolean) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Default.CheckCircle, null, tint = Correct, modifier = Modifier.size(64.dp))
        Spacer(Modifier.height(16.dp))
        Text(
            if (isReviewSession) "No words due for review right now" else "No words in this category",
            color = TextSecondary,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun SessionSummary(correct: Int, total: Int, onDone: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Default.CheckCircle, null, tint = Correct, modifier = Modifier.size(72.dp))
        Spacer(Modifier.height(16.dp))
        Text("Session complete!", style = MaterialTheme.typography.headlineMedium.copy(color = TextPrimary, fontWeight = FontWeight.Bold))
        Spacer(Modifier.height(8.dp))
        Text("$correct / $total answered well", color = TextSecondary)
        Spacer(Modifier.height(24.dp))
        Button(onClick = onDone, colors = ButtonDefaults.buttonColors(containerColor = TealMedium)) {
            Text("Done")
        }
    }
}
