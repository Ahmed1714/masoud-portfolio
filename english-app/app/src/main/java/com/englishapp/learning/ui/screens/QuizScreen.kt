package com.englishapp.learning.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.englishapp.learning.data.db.entities.WordEntity
import com.englishapp.learning.ui.theme.*
import com.englishapp.learning.ui.viewmodels.QuizViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuizScreen(
    category: String?,
    onBack: () -> Unit,
    viewModel: QuizViewModel = hiltViewModel()
) {
    LaunchedEffect(category) { viewModel.loadQuiz(category) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(category ?: "Quiz", color = TextPrimary, fontWeight = FontWeight.Bold) },
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
                state.questions.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = TealLight)
                    }
                }
                state.isComplete -> QuizSummary(score = state.score, total = state.questions.size, onDone = onBack)
                else -> {
                    val question = state.currentQuestion
                    if (question != null) {
                        LinearProgressIndicator(
                            progress = { (state.currentIndex) / state.questions.size.toFloat() },
                            modifier = Modifier.fillMaxWidth(),
                            color = TealLight,
                            trackColor = InkSurface
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "${state.currentIndex + 1} / ${state.questions.size}  ·  Score: ${state.score}",
                            color = TextSecondary,
                            style = MaterialTheme.typography.labelMedium
                        )
                        Spacer(Modifier.height(32.dp))

                        Text(
                            text = "What does this mean?",
                            style = MaterialTheme.typography.bodyLarge.copy(color = TextSecondary),
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = question.word.english,
                            style = MaterialTheme.typography.displayMedium.copy(color = TextPrimary, fontWeight = FontWeight.Bold),
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(32.dp))

                        question.options.forEach { option ->
                            QuizOption(
                                option = option,
                                correctWordId = question.word.id,
                                selectedOptionId = state.selectedOptionId,
                                isAnswered = state.isAnswered,
                                onClick = { viewModel.selectAnswer(option.id) }
                            )
                            Spacer(Modifier.height(10.dp))
                        }

                        Spacer(Modifier.weight(1f))

                        if (state.isAnswered) {
                            Button(
                                onClick = viewModel::nextQuestion,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = TealMedium)
                            ) {
                                Text(if (state.currentIndex == state.questions.size - 1) "Finish" else "Next")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuizOption(
    option: WordEntity,
    correctWordId: Int,
    selectedOptionId: Int?,
    isAnswered: Boolean,
    onClick: () -> Unit
) {
    val containerColor = when {
        !isAnswered -> InkSurface
        option.id == correctWordId -> Correct
        option.id == selectedOptionId -> Wrong
        else -> InkSurface
    }
    Card(
        onClick = onClick,
        enabled = !isAnswered,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = option.translation,
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            color = if (isAnswered && (option.id == correctWordId || option.id == selectedOptionId)) Color.White else TextPrimary,
            style = MaterialTheme.typography.titleMedium
        )
    }
}

@Composable
private fun QuizSummary(score: Int, total: Int, onDone: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Default.EmojiEvents, null, tint = Amber, modifier = Modifier.size(72.dp))
        Spacer(Modifier.height(16.dp))
        Text("Quiz complete!", style = MaterialTheme.typography.headlineMedium.copy(color = TextPrimary, fontWeight = FontWeight.Bold))
        Spacer(Modifier.height(8.dp))
        Text("You scored $score / $total", color = TextSecondary, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(24.dp))
        Button(onClick = onDone, colors = ButtonDefaults.buttonColors(containerColor = TealMedium)) {
            Text("Done")
        }
    }
}
