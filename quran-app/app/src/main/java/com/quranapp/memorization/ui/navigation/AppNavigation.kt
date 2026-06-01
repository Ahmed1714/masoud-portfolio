package com.quranapp.memorization.ui.navigation

import androidx.compose.animation.*
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.quranapp.memorization.ui.screens.*

sealed class Screen(val route: String) {
    object Home        : Screen("home")
    object SurahDetail : Screen("surah/{surahNumber}") {
        fun createRoute(surahNumber: Int) = "surah/$surahNumber"
    }
    object Listen      : Screen("listen/{surahNumber}?startAyah={startAyah}") {
        fun createRoute(surahNumber: Int, startAyah: Int = 0) =
            "listen/$surahNumber?startAyah=$startAyah"
    }
    object Memorize    : Screen("memorize/{surahNumber}?startAyah={startAyah}") {
        fun createRoute(surahNumber: Int, startAyah: Int = 0) =
            "memorize/$surahNumber?startAyah=$startAyah"
    }
    object Tasmi       : Screen("tasmi/{surahNumber}?startAyah={startAyah}") {
        fun createRoute(surahNumber: Int, startAyah: Int = 0) =
            "tasmi/$surahNumber?startAyah=$startAyah"
    }
    object Progress    : Screen("progress")
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.Home.route,
        enterTransition  = { slideInHorizontally { it } + fadeIn() },
        exitTransition   = { slideOutHorizontally { -it } + fadeOut() },
        popEnterTransition  = { slideInHorizontally { -it } + fadeIn() },
        popExitTransition   = { slideOutHorizontally { it } + fadeOut() }
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onSurahClick   = { navController.navigate(Screen.SurahDetail.createRoute(it)) },
                onProgressClick = { navController.navigate(Screen.Progress.route) }
            )
        }

        composable(
            route = Screen.SurahDetail.route,
            arguments = listOf(navArgument("surahNumber") { type = NavType.IntType })
        ) { back ->
            val surahNumber = back.arguments?.getInt("surahNumber") ?: 1
            SurahDetailScreen(
                surahNumber  = surahNumber,
                onBack       = { navController.popBackStack() },
                onListen     = { n, idx -> navController.navigate(Screen.Listen.createRoute(n, idx)) },
                onMemorize   = { n, idx -> navController.navigate(Screen.Memorize.createRoute(n, idx)) },
                onTasmi      = { n, idx -> navController.navigate(Screen.Tasmi.createRoute(n, idx)) }
            )
        }

        composable(
            route = Screen.Listen.route,
            arguments = listOf(
                navArgument("surahNumber") { type = NavType.IntType },
                navArgument("startAyah")  { type = NavType.IntType; defaultValue = 0 }
            )
        ) { back ->
            ListenScreen(
                surahNumber = back.arguments?.getInt("surahNumber") ?: 1,
                startAyah   = back.arguments?.getInt("startAyah") ?: 0,
                onBack      = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Memorize.route,
            arguments = listOf(
                navArgument("surahNumber") { type = NavType.IntType },
                navArgument("startAyah")  { type = NavType.IntType; defaultValue = 0 }
            )
        ) { back ->
            MemorizationScreen(
                surahNumber = back.arguments?.getInt("surahNumber") ?: 1,
                startAyah   = back.arguments?.getInt("startAyah") ?: 0,
                onBack      = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Tasmi.route,
            arguments = listOf(
                navArgument("surahNumber") { type = NavType.IntType },
                navArgument("startAyah")  { type = NavType.IntType; defaultValue = 0 }
            )
        ) { back ->
            TasmiScreen(
                surahNumber = back.arguments?.getInt("surahNumber") ?: 1,
                startAyah   = back.arguments?.getInt("startAyah") ?: 0,
                onBack      = { navController.popBackStack() }
            )
        }

        composable(Screen.Progress.route) {
            ProgressScreen(onBack = { navController.popBackStack() })
        }
    }
}
