package com.quranapp.memorization.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import com.quranapp.memorization.ui.theme.*
import com.quranapp.memorization.ui.viewmodels.QuranViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProgressScreen(
    onBack: () -> Unit,
    viewModel: QuranViewModel = hiltViewModel()
) {
    val memorizedCount  by viewModel.memorizedCount.collectAsStateWithLifecycle()
    val inProgressCount by viewModel.inProgressCount.collectAsStateWithLifecycle()
    val memorizedSurahs by viewModel.memorizedSurahCount.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("تقدمي في الحفظ", color = Gold, fontWeight = FontWeight.Bold) },
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
        LazyColumn(
            contentPadding = PaddingValues(
                start = 16.dp, end = 16.dp,
                top = padding.calculateTopPadding() + 16.dp,
                bottom = 24.dp
            ),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Overall stats
            item {
                OverallStatsSection(
                    memorizedAyahs  = memorizedCount,
                    inProgressAyahs = inProgressCount,
                    memorizedSurahs = memorizedSurahs
                )
            }

            // Overall progress bar
            item {
                val total      = 6236
                val percentage = (memorizedCount.toFloat() / total * 100).toInt()
                ProgressBarCard(
                    label    = "القرآن الكريم كاملاً",
                    current  = memorizedCount,
                    total    = total,
                    subtitle = "$percentage% من القرآن الكريم",
                    color    = GreenLight
                )
            }

            // Tips section
            item {
                TipsCard()
            }
        }
    }
}

@Composable
private fun OverallStatsSection(memorizedAyahs: Int, inProgressAyahs: Int, memorizedSurahs: Int) {
    Text(
        "إحصائياتك",
        style = MaterialTheme.typography.titleLarge.copy(color = TextPrimary, fontWeight = FontWeight.Bold)
    )
    Spacer(Modifier.height(12.dp))

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        BigStatCard(
            modifier      = Modifier.weight(1f),
            value         = memorizedAyahs.toString(),
            label         = "آية محفوظة",
            icon          = Icons.Default.CheckCircle,
            color         = Correct
        )
        BigStatCard(
            modifier      = Modifier.weight(1f),
            value         = inProgressAyahs.toString(),
            label         = "قيد الحفظ",
            icon          = Icons.Default.Schedule,
            color         = Acceptable
        )
        BigStatCard(
            modifier      = Modifier.weight(1f),
            value         = memorizedSurahs.toString(),
            label         = "سورة محفوظة",
            icon          = Icons.Default.Star,
            color         = Gold
        )
    }
}

@Composable
private fun BigStatCard(modifier: Modifier, value: String, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.12f)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, null, tint = color, modifier = Modifier.size(28.dp))
            Spacer(Modifier.height(6.dp))
            Text(value, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = color)
            Text(label, color = TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun ProgressBarCard(label: String, current: Int, total: Int, subtitle: String, color: Color) {
    val fraction = if (total > 0) current.toFloat() / total.toFloat() else 0f

    Card(
        colors = CardDefaults.cardColors(containerColor = NavySurface),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(label, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                Text("$current / $total", color = TextSecondary, fontSize = 13.sp)
            }
            Spacer(Modifier.height(10.dp))
            LinearProgressIndicator(
                progress = { fraction },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(10.dp),
                color = color,
                trackColor = NavyCard
            )
            Spacer(Modifier.height(6.dp))
            Text(subtitle, color = color, fontSize = 12.sp)
        }
    }
}

@Composable
private fun TipsCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = NavySurface),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Lightbulb, null, tint = Gold, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("نصائح للحفظ", color = Gold, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(12.dp))
            val tips = listOf(
                "احفظ آية أو آيتين يومياً بشكل منتظم",
                "كرر المراجعة صباحاً ومساءً",
                "استخدم وضع التسميع لاختبار نفسك",
                "استمع للشيخ عبد الباسط لترسيخ المخارج",
                "ربط الآيات بمعانيها يساعد على الحفظ"
            )
            tips.forEach { tip ->
                Row(modifier = Modifier.padding(vertical = 4.dp)) {
                    Text("•  ", color = GreenLight)
                    Text(tip, color = TextSecondary, fontSize = 14.sp)
                }
            }
        }
    }
}
