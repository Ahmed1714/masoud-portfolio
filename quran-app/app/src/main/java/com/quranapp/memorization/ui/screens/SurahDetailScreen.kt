package com.quranapp.memorization.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import com.quranapp.memorization.ui.theme.*
import com.quranapp.memorization.ui.viewmodels.SurahDetailViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SurahDetailScreen(
    surahNumber: Int,
    onBack: () -> Unit,
    onListen: (Int, Int) -> Unit,
    onMemorize: (Int, Int) -> Unit,
    onTasmi: (Int, Int) -> Unit,
    viewModel: SurahDetailViewModel = hiltViewModel()
) {
    LaunchedEffect(surahNumber) { viewModel.loadSurah(surahNumber) }

    val ayahs       by viewModel.ayahs.collectAsStateWithLifecycle()
    val progressMap by viewModel.progressMap.collectAsStateWithLifecycle()
    val isLoading   by viewModel.isLoading.collectAsStateWithLifecycle()
    val listState   = rememberLazyListState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (ayahs.isNotEmpty()) "سورة رقم $surahNumber" else "جاري التحميل...",
                        color = Gold,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, null, tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NavyMedium)
            )
        },
        bottomBar = {
            BottomActionBar(
                onListen   = { onListen(surahNumber, 0) },
                onMemorize = { onMemorize(surahNumber, 0) },
                onTasmi    = { onTasmi(surahNumber, 0) }
            )
        },
        containerColor = NavyDark
    ) { padding ->
        if (isLoading && ayahs.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = GreenLight)
            }
        } else {
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(
                    start = 16.dp, end = 16.dp,
                    top = padding.calculateTopPadding() + 8.dp,
                    bottom = padding.calculateBottomPadding() + 8.dp
                ),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Basmala (except Surah 9)
                if (surahNumber != 9) {
                    item {
                        Text(
                            text = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ",
                            style = MaterialTheme.typography.titleLarge.copy(
                                color = GoldDark, fontSize = 22.sp,
                                textDirection = TextDirection.Rtl
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }

                itemsIndexed(ayahs, key = { _, a -> a.globalNumber }) { index, ayah ->
                    AyahCard(
                        ayah = ayah,
                        progress = progressMap[ayah.globalNumber],
                        onListenClick = { onListen(surahNumber, index) },
                        onMemorizeClick = { onMemorize(surahNumber, index) },
                        onTasmiClick = { onTasmi(surahNumber, index) }
                    )
                }
            }
        }
    }
}

@Composable
private fun AyahCard(
    ayah: CachedAyah,
    progress: MemorizationProgress?,
    onListenClick: () -> Unit,
    onMemorizeClick: () -> Unit,
    onTasmiClick: () -> Unit
) {
    val statusColor = when (progress?.status) {
        MemorizationStatus.MEMORIZED     -> Correct
        MemorizationStatus.IN_PROGRESS   -> Acceptable
        MemorizationStatus.NEEDS_REVIEW  -> Wrong
        else                              -> Color.Transparent
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (progress?.status != null && progress.status != MemorizationStatus.NOT_STARTED)
                Modifier.border(1.dp, statusColor.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
            else Modifier),
        colors = CardDefaults.cardColors(
            containerColor = if (progress?.status == MemorizationStatus.MEMORIZED)
                MemorizedBg else NavySurface
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Ayah number row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Action buttons
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    SmallActionButton(icon = Icons.Default.VolumeUp, tint = GreenLight, onClick = onListenClick)
                    SmallActionButton(icon = Icons.Default.MenuBook, tint = GoldDark, onClick = onMemorizeClick)
                    SmallActionButton(icon = Icons.Default.RecordVoiceOver, tint = Acceptable, onClick = onTasmiClick)
                }

                // Number badge
                Row(verticalAlignment = Alignment.CenterVertically) {
                    progress?.status?.let { status ->
                        Icon(
                            imageVector = when (status) {
                                MemorizationStatus.MEMORIZED    -> Icons.Default.CheckCircle
                                MemorizationStatus.IN_PROGRESS  -> Icons.Default.Schedule
                                MemorizationStatus.NEEDS_REVIEW -> Icons.Default.Warning
                                else -> Icons.Default.RadioButtonUnchecked
                            },
                            contentDescription = null,
                            tint = statusColor,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                    }
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .background(GreenDark, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(ayah.numberInSurah.toString(), color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Ayah text (Arabic)
            Text(
                text = ayah.text,
                style = MaterialTheme.typography.bodyLarge.copy(
                    color = TextPrimary,
                    fontSize = 22.sp,
                    lineHeight = 42.sp,
                    textDirection = TextDirection.Rtl
                ),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Right
            )

            if (progress != null && progress.repetitions > 0) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "مراجعات: ${progress.repetitions} | صح: ${progress.correctCount} | خطأ: ${progress.wrongCount}",
                    style = MaterialTheme.typography.labelSmall.copy(color = TextHint)
                )
            }
        }
    }
}

@Composable
private fun SmallActionButton(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, onClick: () -> Unit) {
    IconButton(onClick = onClick, modifier = Modifier.size(32.dp)) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun BottomActionBar(onListen: () -> Unit, onMemorize: () -> Unit, onTasmi: () -> Unit) {
    Surface(color = NavyMedium, tonalElevation = 8.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ActionButton(
                modifier = Modifier.weight(1f),
                label = "استماع",
                icon = Icons.Default.VolumeUp,
                color = GreenMedium,
                onClick = onListen
            )
            ActionButton(
                modifier = Modifier.weight(1f),
                label = "حفظ",
                icon = Icons.Default.MenuBook,
                color = NavyCard,
                onClick = onMemorize
            )
            ActionButton(
                modifier = Modifier.weight(1f),
                label = "تسميع",
                icon = Icons.Default.RecordVoiceOver,
                color = GoldDark.copy(red = 0.6f),
                onClick = onTasmi
            )
        }
    }
}

@Composable
private fun ActionButton(modifier: Modifier, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = modifier,
        colors = ButtonDefaults.buttonColors(containerColor = color),
        shape = RoundedCornerShape(10.dp)
    ) {
        Icon(icon, null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, fontSize = 13.sp)
    }
}
