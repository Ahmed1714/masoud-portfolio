package com.quranapp.memorization.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.quranapp.memorization.ui.theme.*
import com.quranapp.memorization.ui.viewmodels.MemorizationViewModel
import com.quranapp.memorization.ui.viewmodels.PlayerViewModel
import com.quranapp.memorization.ui.viewmodels.TasmiAyahState
import com.quranapp.memorization.ui.viewmodels.TasmiResult

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasmiScreen(
    surahNumber: Int,
    startAyah: Int,
    onBack: () -> Unit,
    viewModel: MemorizationViewModel = hiltViewModel(),
    playerViewModel: PlayerViewModel = hiltViewModel()
) {
    val context = LocalContext.current

    LaunchedEffect(surahNumber) {
        viewModel.loadSurah(surahNumber)
    }

    val ayahs           by viewModel.ayahs.collectAsStateWithLifecycle()
    val tasmiStates     by viewModel.tasmiStates.collectAsStateWithLifecycle()
    val tasmiIndex      by viewModel.tasmiCurrentIndex.collectAsStateWithLifecycle()
    val sessionComplete by viewModel.tasmiSessionComplete.collectAsStateWithLifecycle()
    val isPlaying       by playerViewModel.isPlaying.collectAsStateWithLifecycle()

    LaunchedEffect(ayahs) {
        if (ayahs.isNotEmpty()) {
            playerViewModel.initialize(context, ayahs, startAyah)
        }
    }

    val sessionStarted = tasmiStates.isNotEmpty()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("وضع التسميع", color = Gold, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, null, tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NavyMedium)
            )
        },
        containerColor = NavyDark
    ) { padding ->
        AnimatedContent(
            targetState = when {
                sessionComplete     -> "complete"
                sessionStarted      -> "active"
                else                -> "start"
            },
            transitionSpec = { fadeIn() + slideInVertically { it / 2 } togetherWith fadeOut() },
            label = "tasmi_state",
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) { state ->
            when (state) {
                "start" -> TasmiStartScreen(
                    surahNumber   = surahNumber,
                    ayahCount     = ayahs.size,
                    onStart       = { viewModel.startTasmiSession(startAyah) }
                )
                "active" -> TasmiActiveScreen(
                    states        = tasmiStates,
                    currentIndex  = tasmiIndex,
                    isPlaying     = isPlaying,
                    onReveal      = { viewModel.revealCurrentAyah() },
                    onMarkCorrect = { viewModel.markTasmiResult(TasmiResult.CORRECT) },
                    onMarkAcceptable = { viewModel.markTasmiResult(TasmiResult.ACCEPTABLE) },
                    onMarkWrong   = { viewModel.markTasmiResult(TasmiResult.WRONG) },
                    onPlayAudio   = {
                        val globalIdx = startAyah + tasmiIndex
                        playerViewModel.seekToAyah(globalIdx)
                        playerViewModel.playCurrentAyah()
                    },
                    onStopAudio   = { playerViewModel.togglePlayPause() }
                )
                "complete" -> TasmiResultScreen(
                    states  = tasmiStates,
                    onReset = { viewModel.resetTasmiSession() },
                    onBack  = onBack
                )
            }
        }
    }
}

@Composable
private fun TasmiStartScreen(surahNumber: Int, ayahCount: Int, onStart: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.RecordVoiceOver,
            null,
            tint = Gold,
            modifier = Modifier.size(80.dp)
        )
        Spacer(Modifier.height(24.dp))
        Text(
            "وضع التسميع",
            style = MaterialTheme.typography.displayMedium.copy(color = Gold, fontWeight = FontWeight.Bold)
        )
        Spacer(Modifier.height(12.dp))
        Text(
            "سورة رقم $surahNumber · $ayahCount آية",
            style = MaterialTheme.typography.titleMedium.copy(color = TextSecondary)
        )
        Spacer(Modifier.height(32.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = NavySurface),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                InstructionRow(number = "١", text = "ابدأ بتسميع الآيات من حفظك")
                InstructionRow(number = "٢", text = "اضغط 'أظهر الآية' للتصحيح")
                InstructionRow(number = "٣", text = "قيّم أداءك: صحيح / مقبول / خطأ")
                InstructionRow(number = "٤", text = "يمكنك الاستماع للتلاوة في أي وقت")
            }
        }

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = onStart,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = GreenMedium),
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(Icons.Default.PlayArrow, null, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(8.dp))
            Text("ابدأ التسميع", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun InstructionRow(number: String, text: String) {
    Row(
        modifier = Modifier.padding(vertical = 6.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            number,
            color = Gold,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(32.dp),
            textAlign = TextAlign.Center,
            fontSize = 16.sp
        )
        Text(text, color = TextSecondary, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun TasmiActiveScreen(
    states: List<TasmiAyahState>,
    currentIndex: Int,
    isPlaying: Boolean,
    onReveal: () -> Unit,
    onMarkCorrect: () -> Unit,
    onMarkAcceptable: () -> Unit,
    onMarkWrong: () -> Unit,
    onPlayAudio: () -> Unit,
    onStopAudio: () -> Unit
) {
    val currentState = states.getOrNull(currentIndex) ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Progress
        LinearProgressIndicator(
            progress = { (currentIndex + 1).toFloat() / states.size.toFloat() },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp),
            color = GreenLight,
            trackColor = NavyCard
        )

        Spacer(Modifier.height(8.dp))

        Text(
            "الآية ${currentIndex + 1} من ${states.size}",
            color = TextSecondary,
            fontSize = 14.sp
        )

        Spacer(Modifier.weight(0.2f))

        // Ayah number badge
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(GreenDark, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                currentState.ayah.numberInSurah.toString(),
                color = Gold,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(Modifier.height(24.dp))

        // Main card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = NavySurface),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                AnimatedContent(
                    targetState = currentState.isRevealed,
                    transitionSpec = { fadeIn() togetherWith fadeOut() },
                    label = "ayah_reveal"
                ) { revealed ->
                    if (revealed) {
                        Text(
                            text = currentState.ayah.text,
                            style = MaterialTheme.typography.bodyLarge.copy(
                                fontSize = 24.sp,
                                lineHeight = 44.sp,
                                color = TextPrimary,
                                textDirection = TextDirection.Rtl
                            ),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(vertical = 16.dp)
                        ) {
                            Icon(Icons.Default.MicNone, null, tint = GreenLight, modifier = Modifier.size(48.dp))
                            Spacer(Modifier.height(12.dp))
                            Text("اقرأ الآية من حفظك", color = TextSecondary, fontSize = 16.sp)
                            Spacer(Modifier.height(20.dp))
                            Button(
                                onClick = onReveal,
                                colors = ButtonDefaults.buttonColors(containerColor = NavyCard),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Visibility, null, tint = GoldDark)
                                Spacer(Modifier.width(6.dp))
                                Text("أظهر الآية للتصحيح", color = GoldDark)
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Audio button
        OutlinedButton(onClick = if (isPlaying) onStopAudio else onPlayAudio) {
            Icon(
                if (isPlaying) Icons.Default.Pause else Icons.Default.VolumeUp,
                null,
                tint = GreenLight
            )
            Spacer(Modifier.width(6.dp))
            Text(if (isPlaying) "إيقاف" else "استمع للآية", color = GreenLight)
        }

        Spacer(Modifier.weight(1f))

        // Grading buttons (shown after reveal)
        AnimatedVisibility(visible = currentState.isRevealed) {
            Column {
                Text(
                    "كيف كانت تلاوتك؟",
                    color = TextSecondary,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    GradeButton(
                        modifier = Modifier.weight(1f),
                        label = "خطأ",
                        icon = Icons.Default.Close,
                        color = Wrong,
                        onClick = onMarkWrong
                    )
                    GradeButton(
                        modifier = Modifier.weight(1f),
                        label = "مقبول",
                        icon = Icons.Default.Remove,
                        color = Acceptable,
                        onClick = onMarkAcceptable
                    )
                    GradeButton(
                        modifier = Modifier.weight(1f),
                        label = "صحيح",
                        icon = Icons.Default.Check,
                        color = Correct,
                        onClick = onMarkCorrect
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun GradeButton(modifier: Modifier, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = modifier.height(54.dp),
        colors = ButtonDefaults.buttonColors(containerColor = color),
        shape = RoundedCornerShape(12.dp)
    ) {
        Icon(icon, null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TasmiResultScreen(
    states: List<TasmiAyahState>,
    onReset: () -> Unit,
    onBack: () -> Unit
) {
    val correct    = states.count { it.result == TasmiResult.CORRECT }
    val acceptable = states.count { it.result == TasmiResult.ACCEPTABLE }
    val wrong      = states.count { it.result == TasmiResult.WRONG }
    val total      = states.size
    val score      = if (total > 0) ((correct + acceptable * 0.5f) / total * 100).toInt() else 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(16.dp))

        Text("نتيجة التسميع", style = MaterialTheme.typography.headlineLarge.copy(color = Gold, fontWeight = FontWeight.Bold))

        Spacer(Modifier.height(32.dp))

        // Score circle
        Box(
            modifier = Modifier
                .size(120.dp)
                .background(
                    when {
                        score >= 80 -> Correct.copy(alpha = 0.15f)
                        score >= 50 -> Acceptable.copy(alpha = 0.15f)
                        else        -> Wrong.copy(alpha = 0.15f)
                    },
                    RoundedCornerShape(60.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "$score%",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        score >= 80 -> Correct
                        score >= 50 -> Acceptable
                        else        -> Wrong
                    }
                )
                Text(
                    when {
                        score >= 80 -> "ممتاز"
                        score >= 60 -> "جيد"
                        score >= 40 -> "مقبول"
                        else        -> "تحتاج مراجعة"
                    },
                    color = TextSecondary,
                    fontSize = 14.sp
                )
            }
        }

        Spacer(Modifier.height(32.dp))

        // Stats
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ResultStatCard(Modifier.weight(1f), correct.toString(), "صحيح", Correct)
            ResultStatCard(Modifier.weight(1f), acceptable.toString(), "مقبول", Acceptable)
            ResultStatCard(Modifier.weight(1f), wrong.toString(), "خطأ", Wrong)
        }

        Spacer(Modifier.height(24.dp))

        // Ayah by ayah breakdown
        Text("تفاصيل الآيات", color = TextSecondary, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            itemsIndexed(states) { _, state ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = when (state.result) {
                            TasmiResult.CORRECT    -> Correct.copy(alpha = 0.1f)
                            TasmiResult.ACCEPTABLE -> Acceptable.copy(alpha = 0.1f)
                            TasmiResult.WRONG      -> Wrong.copy(alpha = 0.1f)
                            null                   -> NavySurface
                        }
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = when (state.result) {
                                TasmiResult.CORRECT    -> Icons.Default.CheckCircle
                                TasmiResult.ACCEPTABLE -> Icons.Default.RemoveCircle
                                TasmiResult.WRONG      -> Icons.Default.Cancel
                                null                   -> Icons.Default.Circle
                            },
                            contentDescription = null,
                            tint = when (state.result) {
                                TasmiResult.CORRECT    -> Correct
                                TasmiResult.ACCEPTABLE -> Acceptable
                                TasmiResult.WRONG      -> Wrong
                                null                   -> TextHint
                            },
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = state.ayah.text,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = TextPrimary,
                                textDirection = TextDirection.Rtl,
                                fontSize = 16.sp
                            ),
                            maxLines = 2,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Right
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth().navigationBarsPadding(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("العودة")
            }
            Button(
                onClick = onReset,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = GreenMedium),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Refresh, null)
                Spacer(Modifier.width(4.dp))
                Text("تسميع جديد")
            }
        }
    }
}

@Composable
private fun ResultStatCard(modifier: Modifier, value: String, label: String, color: Color) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.15f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = color)
            Text(label, color = TextSecondary, fontSize = 13.sp)
        }
    }
}
