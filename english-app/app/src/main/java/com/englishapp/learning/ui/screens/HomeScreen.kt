package com.englishapp.learning.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.englishapp.learning.ui.theme.*
import com.englishapp.learning.ui.viewmodels.HomeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onCategoryClick: (String) -> Unit,
    onReviewClick: () -> Unit,
    onQuizClick: () -> Unit,
    onProgressClick: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "English Master",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Amber
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )
                },
                actions = {
                    IconButton(onClick = onProgressClick) {
                        Icon(Icons.Default.BarChart, contentDescription = "Progress", tint = Amber)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = InkMedium)
            )
        },
        containerColor = InkDark
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(modifier = Modifier.weight(1f), label = "Words", value = state.totalWords.toString(), icon = Icons.Default.MenuBook)
                StatCard(modifier = Modifier.weight(1f), label = "Mastered", value = state.masteredCount.toString(), icon = Icons.Default.Star)
                StatCard(modifier = Modifier.weight(1f), label = "Due today", value = state.dueCount.toString(), icon = Icons.Default.Schedule)
            }

            if (state.dueCount > 0) {
                Card(
                    onClick = onReviewClick,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    colors = CardDefaults.cardColors(containerColor = TealMedium),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Refresh, null, tint = Color.White, modifier = Modifier.size(32.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Review due words", color = Color.White, fontWeight = FontWeight.Bold)
                            Text("${state.dueCount} words are ready for spaced review", color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyMedium)
                        }
                        Icon(Icons.Default.ChevronRight, null, tint = Color.White)
                    }
                }
            }

            Card(
                onClick = onQuizClick,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                colors = CardDefaults.cardColors(containerColor = InkSurface),
                shape = RoundedCornerShape(14.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Quiz, null, tint = Amber, modifier = Modifier.size(32.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Quick quiz", color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text("Test yourself with a mixed 10-word quiz", color = TextSecondary, style = MaterialTheme.typography.bodyMedium)
                    }
                    Icon(Icons.Default.ChevronRight, null, tint = TextSecondary)
                }
            }

            Text(
                text = "Categories",
                style = MaterialTheme.typography.titleMedium.copy(color = TextPrimary, fontWeight = FontWeight.SemiBold),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )

            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.categories, key = { it }) { category ->
                    CategoryListItem(category = category, onClick = { onCategoryClick(category) })
                }
            }
        }
    }
}

@Composable
private fun StatCard(modifier: Modifier, label: String, value: String, icon: ImageVector) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = InkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, null, tint = Amber, modifier = Modifier.size(22.dp))
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.titleLarge.copy(color = Amber, fontWeight = FontWeight.Bold))
            Text(label, style = MaterialTheme.typography.labelMedium.copy(color = TextSecondary))
        }
    }
}

@Composable
private fun CategoryListItem(category: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = InkSurface),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brush.radialGradient(listOf(TealLight, TealDark))),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Category, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(16.dp))
            Text(
                text = category,
                style = MaterialTheme.typography.titleMedium.copy(color = TextPrimary, fontWeight = FontWeight.SemiBold),
                modifier = Modifier.weight(1f)
            )
            Icon(Icons.Default.ChevronRight, null, tint = TextHint)
        }
    }
}
