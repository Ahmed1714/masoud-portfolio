package com.englishapp.learning.ui.navigation

import android.net.Uri
import androidx.compose.animation.*
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.englishapp.learning.ui.screens.*

private const val REVIEW_MODE = "__review__"
private const val ALL_MODE = "__all__"

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Category : Screen("category/{category}") {
        fun createRoute(category: String) = "category/${Uri.encode(category)}"
    }
    object Flashcards : Screen("flashcards/{mode}") {
        fun reviewRoute() = "flashcards/$REVIEW_MODE"
        fun categoryRoute(category: String) = "flashcards/${Uri.encode(category)}"
    }
    object Quiz : Screen("quiz/{mode}") {
        fun allRoute() = "quiz/$ALL_MODE"
        fun categoryRoute(category: String) = "quiz/${Uri.encode(category)}"
    }
    object Progress : Screen("progress")
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.Home.route,
        enterTransition = { slideInHorizontally { it } + fadeIn() },
        exitTransition = { slideOutHorizontally { -it } + fadeOut() },
        popEnterTransition = { slideInHorizontally { -it } + fadeIn() },
        popExitTransition = { slideOutHorizontally { it } + fadeOut() }
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onCategoryClick = { navController.navigate(Screen.Category.createRoute(it)) },
                onReviewClick = { navController.navigate(Screen.Flashcards.reviewRoute()) },
                onQuizClick = { navController.navigate(Screen.Quiz.allRoute()) },
                onProgressClick = { navController.navigate(Screen.Progress.route) }
            )
        }

        composable(
            route = Screen.Category.route,
            arguments = listOf(navArgument("category") { type = NavType.StringType })
        ) { back ->
            val category = Uri.decode(back.arguments?.getString("category") ?: "")
            CategoryScreen(
                category = category,
                onBack = { navController.popBackStack() },
                onStudy = { navController.navigate(Screen.Flashcards.categoryRoute(category)) },
                onQuiz = { navController.navigate(Screen.Quiz.categoryRoute(category)) }
            )
        }

        composable(
            route = Screen.Flashcards.route,
            arguments = listOf(navArgument("mode") { type = NavType.StringType })
        ) { back ->
            val mode = back.arguments?.getString("mode") ?: REVIEW_MODE
            FlashcardScreen(
                isReviewSession = mode == REVIEW_MODE,
                category = if (mode == REVIEW_MODE) null else Uri.decode(mode),
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Quiz.route,
            arguments = listOf(navArgument("mode") { type = NavType.StringType })
        ) { back ->
            val mode = back.arguments?.getString("mode") ?: ALL_MODE
            QuizScreen(
                category = if (mode == ALL_MODE) null else Uri.decode(mode),
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Progress.route) {
            ProgressScreen(onBack = { navController.popBackStack() })
        }
    }
}
