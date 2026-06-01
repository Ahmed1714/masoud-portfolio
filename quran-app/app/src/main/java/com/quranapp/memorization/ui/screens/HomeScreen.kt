package com.quranapp.memorization.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.quranapp.memorization.data.db.entities.CachedSurah
import com.quranapp.memorization.ui.theme.*
import com.quranapp.memorization.ui.viewmodels.QuranViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onSurahClick: (Int) -> Unit,
    onProgressClick: () -> Unit,
    viewModel: QuranViewModel = hiltViewModel()
) {
    val surahs        by viewModel.filteredSurahs.collectAsStateWithLifecycle()
    val isLoading     by viewModel.isLoading.collectAsStateWithLifecycle()
    val error         by viewModel.error.collectAsStateWithLifecycle()
    val searchQuery   by viewModel.searchQuery.collectAsStateWithLifecycle()
    val memorizedCount by viewModel.memorizedCount.collectAsStateWithLifecycle()
    val memorizedSurahCount by viewModel.memorizedSurahCount.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "تحفيظ القرآن الكريم",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Gold
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )
                },
                actions = {
                    IconButton(onClick = onProgressClick) {
                        Icon(Icons.Default.BarChart, contentDescription = "التقدم", tint = Gold)
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
        ) {
            // Stats banner
            StatsRow(memorizedAyahs = memorizedCount, memorizedSurahs = memorizedSurahCount)

            // Basmala
            Text(
                text = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِیمِ",
                style = MaterialTheme.typography.titleLarge.copy(
                    color = GoldDark,
                    fontSize = 20.sp
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                textAlign = TextAlign.Center
            )

            // Search
            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::onSearchQueryChanged,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("ابحث عن سورة...", color = TextHint) },
                leadingIcon = { Icon(Icons.Default.Search, null, tint = TextHint) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                            Icon(Icons.Default.Clear, null, tint = TextHint)
                        }
                    }
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = GreenLight,
                    unfocusedBorderColor = NavyCard,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    cursorColor = GreenLight,
                    focusedContainerColor = NavySurface,
                    unfocusedContainerColor = NavySurface
                )
            )

            when {
                isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = GreenLight)
                        Spacer(Modifier.height(16.dp))
                        Text("جاري تحميل القرآن الكريم...", color = TextSecondary)
                    }
                }
                error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                        Icon(Icons.Default.WifiOff, null, tint = Wrong, modifier = Modifier.size(64.dp))
                        Spacer(Modifier.height(16.dp))
                        Text(error!!, color = TextSecondary, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = { viewModel.clearError() }, colors = ButtonDefaults.buttonColors(containerColor = GreenMedium)) {
                            Text("إعادة المحاولة")
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(surahs, key = { it.number }) { surah ->
                            SurahListItem(surah = surah, onClick = { onSurahClick(surah.number) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatsRow(memorizedAyahs: Int, memorizedSurahs: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatCard(
            modifier = Modifier.weight(1f),
            label = "آيات محفوظة",
            value = memorizedAyahs.toString(),
            icon = Icons.Default.MenuBook
        )
        StatCard(
            modifier = Modifier.weight(1f),
            label = "سور محفوظة",
            value = memorizedSurahs.toString(),
            icon = Icons.Default.Star
        )
    }
}

@Composable
private fun StatCard(modifier: Modifier, label: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NavySurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, null, tint = Gold, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(8.dp))
            Column {
                Text(value, style = MaterialTheme.typography.headlineMedium.copy(color = Gold, fontWeight = FontWeight.Bold))
                Text(label, style = MaterialTheme.typography.labelMedium.copy(color = TextSecondary))
            }
        }
    }
}

@Composable
private fun SurahListItem(surah: CachedSurah, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NavySurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Number badge
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brush.radialGradient(listOf(GreenMedium, GreenDark))),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = surah.number.toString(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
            }

            Spacer(Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = surah.englishName,
                    style = MaterialTheme.typography.titleMedium.copy(color = TextPrimary, fontWeight = FontWeight.SemiBold)
                )
                Text(
                    text = "${surah.englishNameTranslation} · ${surah.numberOfAyahs} آية",
                    style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
                )
                Text(
                    text = if (surah.revelationType == "Meccan") "مكية" else "مدنية",
                    style = MaterialTheme.typography.labelMedium.copy(
                        color = if (surah.revelationType == "Meccan") GreenLight else GoldDark
                    )
                )
            }

            // Arabic name
            Text(
                text = surah.name,
                style = MaterialTheme.typography.titleLarge.copy(
                    color = Gold,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    textDirection = TextDirection.Rtl
                )
            )
        }
    }
}
