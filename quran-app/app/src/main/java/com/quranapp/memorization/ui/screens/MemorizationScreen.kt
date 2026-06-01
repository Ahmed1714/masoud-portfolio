package com.quranapp.memorization.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import com.quranapp.memorization.ui.theme.*
import com.quranapp.memorization.ui.viewmodels.MemorizationViewModel
import com.quranapp.memorization.ui.viewmodels.PlayerViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemorizationScreen(
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

    val ayahs        by viewModel.ayahs.collectAsStateWithLifecycle()
    val currentIndex by viewModel.currentIndex.collectAsStateWithLifecycle()
    val isHidden     by viewModel.isTextHidden.collectAsStateWithLifecycle()
    val progressMap  by viewModel.progressMap.collectAsStateWithLifecycle()
    val isPlaying    by playerViewModel.isPlaying.collectAsStateWithLifecycle()

    LaunchedEffect(ayahs) {
        if (ayahs.isNotEmpty()) {
            viewModel.goToAyah(startAyah)
            playerViewModel.initialize(context, ayahs, startAyah)
        }
    }

    val currentAyah = ayahs.getOrNull(currentIndex)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "وضع الحفظ · ${currentIndex + 1}/${ayahs.size}",
                        color = Gold,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, null, tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.toggleTextVisibility() }) {
                        Icon(
                            imageVector = if (isHidden) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = null,
                            tint = if (isHidden) GoldDark else TextSecondary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NavyMedium)
            )
        },
        containerColor = NavyDark
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Progress bar
            if (ayahs.isNotEmpty()) {
                LinearProgressIndicator(
                    progress = { (currentIndex + 1).toFloat() / ayahs.size.toFloat() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(4.dp),
                    color = GreenLight,
                    trackColor = NavyCard
                )
                Spacer(Modifier.height(16.dp))
            }

            Spacer(Modifier.weight(0.3f))

            // Main ayah card
            currentAyah?.let { ayah ->
                AyahMemorizationCard(
                    ayah = ayah,
                    isTextHidden = isHidden,
                    onReveal = { viewModel.toggleTextVisibility() }
                )

                Spacer(Modifier.height(24.dp))

                // Status buttons
                val currentProgress = progressMap[ayah.globalNumber]
                StatusButtons(
                    currentStatus = currentProgress?.status ?: MemorizationStatus.NOT_STARTED,
                    onStatusChange = { viewModel.markAyahStatus(ayah, it) }
                )

                Spacer(Modifier.height(16.dp))

                // Audio button
                AudioControlRow(
                    isPlaying = isPlaying,
                    onPlayPause = {
                        if (isPlaying) playerViewModel.togglePlayPause()
                        else { playerViewModel.seekToAyah(currentIndex); playerViewModel.playCurrentAyah() }
                    }
                )
            } ?: run {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = GreenLight)
                }
            }

            Spacer(Modifier.weight(1f))

            // Navigation
            NavigationRow(
                onPrevious  = { viewModel.previousAyah() },
                onNext      = { viewModel.nextAyah() },
                hasPrevious = currentIndex > 0,
                hasNext     = currentIndex < ayahs.size - 1
            )
        }
    }
}

@Composable
private fun AyahMemorizationCard(ayah: CachedAyah, isTextHidden: Boolean, onReveal: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 200.dp),
        colors = CardDefaults.cardColors(containerColor = NavySurface),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Ayah number
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(GreenDark, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    ayah.numberInSurah.toString(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(20.dp))

            AnimatedContent(
                targetState = isTextHidden,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "ayah_text"
            ) { hidden ->
                if (hidden) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.VisibilityOff,
                            null,
                            tint = TextHint,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text("اقرأ الآية من الذاكرة", color = TextSecondary, fontSize = 16.sp)
                        Spacer(Modifier.height(12.dp))
                        OutlinedButton(onClick = onReveal, border = ButtonDefaults.outlinedButtonBorder.copy()) {
                            Icon(Icons.Default.Visibility, null, tint = GreenLight)
                            Spacer(Modifier.width(8.dp))
                            Text("أظهر الآية", color = GreenLight)
                        }
                    }
                } else {
                    Text(
                        text = ayah.text,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 26.sp,
                            lineHeight = 46.sp,
                            color = TextPrimary,
                            textDirection = TextDirection.Rtl
                        ),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusButtons(currentStatus: MemorizationStatus, onStatusChange: (MemorizationStatus) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatusButton(
            modifier = Modifier.weight(1f),
            label = "لم أحفظ",
            color = NavyCard,
            selected = currentStatus == MemorizationStatus.NOT_STARTED,
            onClick = { onStatusChange(MemorizationStatus.NOT_STARTED) }
        )
        StatusButton(
            modifier = Modifier.weight(1f),
            label = "قيد الحفظ",
            color = Acceptable,
            selected = currentStatus == MemorizationStatus.IN_PROGRESS,
            onClick = { onStatusChange(MemorizationStatus.IN_PROGRESS) }
        )
        StatusButton(
            modifier = Modifier.weight(1f),
            label = "محفوظة",
            color = Correct,
            selected = currentStatus == MemorizationStatus.MEMORIZED,
            onClick = { onStatusChange(MemorizationStatus.MEMORIZED) }
        )
    }
}

@Composable
private fun StatusButton(modifier: Modifier, label: String, color: Color, selected: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) color else color.copy(alpha = 0.2f)
        ),
        shape = RoundedCornerShape(10.dp)
    ) {
        Text(label, fontSize = 12.sp, color = if (selected) Color.White else color)
    }
}

@Composable
private fun AudioControlRow(isPlaying: Boolean, onPlayPause: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Default.MusicNote, null, tint = GoldDark, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        OutlinedButton(onClick = onPlayPause) {
            Icon(
                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.VolumeUp,
                contentDescription = null,
                tint = GreenLight
            )
            Spacer(Modifier.width(6.dp))
            Text(
                if (isPlaying) "إيقاف الصوت" else "استمع للآية",
                color = GreenLight
            )
        }
    }
}

@Composable
private fun NavigationRow(
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    hasPrevious: Boolean,
    hasNext: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        OutlinedButton(
            onClick = onPrevious,
            enabled = hasPrevious,
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.ArrowBack, null)
            Spacer(Modifier.width(4.dp))
            Text("السابقة")
        }

        FilledTonalButton(
            onClick = onNext,
            enabled = hasNext,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.filledTonalButtonColors(containerColor = GreenMedium)
        ) {
            Text("التالية")
            Spacer(Modifier.width(4.dp))
            Icon(Icons.Default.ArrowForward, null)
        }
    }
}
