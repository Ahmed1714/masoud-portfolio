package com.quranapp.memorization.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
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
import com.quranapp.memorization.ui.viewmodels.PlayerViewModel
import com.quranapp.memorization.ui.viewmodels.RecitationMode
import com.quranapp.memorization.ui.viewmodels.RepeatMode
import com.quranapp.memorization.ui.viewmodels.SurahDetailViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListenScreen(
    surahNumber: Int,
    startAyah: Int,
    onBack: () -> Unit,
    surahViewModel: SurahDetailViewModel = hiltViewModel(),
    playerViewModel: PlayerViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()
    val listState = rememberLazyListState()

    LaunchedEffect(surahNumber) { surahViewModel.loadSurah(surahNumber) }

    val ayahs        by surahViewModel.ayahs.collectAsStateWithLifecycle()
    val currentIndex by playerViewModel.currentIndex.collectAsStateWithLifecycle()
    val isPlaying    by playerViewModel.isPlaying.collectAsStateWithLifecycle()
    val progress     by playerViewModel.progress.collectAsStateWithLifecycle()
    val speed        by playerViewModel.playbackSpeed.collectAsStateWithLifecycle()
    val repeatMode   by playerViewModel.repeatMode.collectAsStateWithLifecycle()
    val recMode      by playerViewModel.recitationMode.collectAsStateWithLifecycle()

    LaunchedEffect(ayahs) {
        if (ayahs.isNotEmpty()) {
            playerViewModel.initialize(context, ayahs, startAyah)
        }
    }

    LaunchedEffect(currentIndex) {
        if (ayahs.isNotEmpty()) {
            scope.launch { listState.animateScrollToItem(currentIndex) }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("الاستماع مع الشيخ عبد الباسط", color = Gold, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { onBack() }) {
                        Icon(Icons.Default.ArrowBack, null, tint = TextPrimary)
                    }
                },
                actions = {
                    TextButton(onClick = { playerViewModel.toggleRecitationMode() }) {
                        Text(
                            if (recMode == RecitationMode.MURATTAL) "مرتّل" else "مجوّد",
                            color = GoldDark
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NavyMedium)
            )
        },
        bottomBar = {
            PlayerControls(
                isPlaying    = isPlaying,
                progress     = progress,
                speed        = speed,
                repeatMode   = repeatMode,
                hasPrevious  = currentIndex > 0,
                hasNext      = currentIndex < ayahs.size - 1,
                onPlayPause  = { playerViewModel.togglePlayPause() },
                onPrevious   = { playerViewModel.previousAyah() },
                onNext       = { playerViewModel.nextAyah() },
                onSeek       = { playerViewModel.seekTo(it) },
                onSpeedChange = { playerViewModel.setSpeed(it) },
                onRepeat     = { playerViewModel.cycleRepeatMode() }
            )
        },
        containerColor = NavyDark
    ) { padding ->
        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(
                start = 16.dp, end = 16.dp,
                top = padding.calculateTopPadding() + 8.dp,
                bottom = padding.calculateBottomPadding() + 8.dp
            ),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            itemsIndexed(ayahs, key = { _, a -> a.globalNumber }) { index, ayah ->
                val isCurrent = index == currentIndex
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { playerViewModel.seekToAyah(index) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isCurrent) AyahHighlight else NavySurface
                    ),
                    shape = RoundedCornerShape(12.dp),
                    border = if (isCurrent) CardDefaults.outlinedCardBorder().copy(
                        brush = Brush.linearGradient(listOf(GreenLight, Gold))
                    ) else null
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = ayah.text,
                                style = MaterialTheme.typography.bodyLarge.copy(
                                    color = if (isCurrent) Gold else TextPrimary,
                                    fontSize = 22.sp,
                                    lineHeight = 40.sp,
                                    textDirection = TextDirection.Rtl
                                ),
                                textAlign = TextAlign.Right,
                                modifier = Modifier.fillMaxWidth()
                            )
                            if (isCurrent) {
                                Spacer(Modifier.height(6.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.GraphicEq, null, tint = GreenLight, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("يُقرأ الآن", color = GreenLight, fontSize = 11.sp)
                                }
                            }
                        }
                        Spacer(Modifier.width(12.dp))
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .background(if (isCurrent) GreenMedium else GreenDark, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(ayah.numberInSurah.toString(), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayerControls(
    isPlaying: Boolean,
    progress: Float,
    speed: Float,
    repeatMode: RepeatMode,
    hasPrevious: Boolean,
    hasNext: Boolean,
    onPlayPause: () -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onSeek: (Float) -> Unit,
    onSpeedChange: (Float) -> Unit,
    onRepeat: () -> Unit
) {
    Surface(color = NavyMedium, tonalElevation = 8.dp) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
            // Progress slider
            Slider(
                value = progress,
                onValueChange = onSeek,
                modifier = Modifier.fillMaxWidth(),
                colors = SliderDefaults.colors(
                    thumbColor = Gold,
                    activeTrackColor = GreenLight,
                    inactiveTrackColor = NavyCard
                )
            )

            Spacer(Modifier.height(8.dp))

            // Controls row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Repeat
                IconButton(onClick = onRepeat) {
                    Icon(
                        imageVector = when (repeatMode) {
                            RepeatMode.SINGLE -> Icons.Default.RepeatOne
                            RepeatMode.ALL    -> Icons.Default.Repeat
                            RepeatMode.NONE   -> Icons.Default.Repeat
                        },
                        contentDescription = null,
                        tint = if (repeatMode == RepeatMode.NONE) TextHint else GreenLight
                    )
                }

                // Previous
                IconButton(onClick = onPrevious, enabled = hasPrevious) {
                    Icon(Icons.Default.SkipPrevious, null, tint = if (hasPrevious) TextPrimary else TextHint, modifier = Modifier.size(32.dp))
                }

                // Play/Pause
                FloatingActionButton(
                    onClick = onPlayPause,
                    containerColor = GreenMedium,
                    modifier = Modifier.size(64.dp)
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(32.dp)
                    )
                }

                // Next
                IconButton(onClick = onNext, enabled = hasNext) {
                    Icon(Icons.Default.SkipNext, null, tint = if (hasNext) TextPrimary else TextHint, modifier = Modifier.size(32.dp))
                }

                // Speed
                TextButton(onClick = {
                    val speeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f)
                    val nextIdx = (speeds.indexOf(speed) + 1) % speeds.size
                    onSpeedChange(speeds[nextIdx])
                }) {
                    Text(
                        text = "${speed}x",
                        color = GoldDark,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
