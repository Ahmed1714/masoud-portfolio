package com.quranapp.memorization.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "surahs")
data class CachedSurah(
    @PrimaryKey val number: Int,
    val name: String,
    val englishName: String,
    val englishNameTranslation: String,
    val numberOfAyahs: Int,
    val revelationType: String
)

@Entity(tableName = "ayahs")
data class CachedAyah(
    @PrimaryKey val globalNumber: Int,
    val surahNumber: Int,
    val numberInSurah: Int,
    val text: String,
    val juz: Int,
    val page: Int
)

@Entity(tableName = "memorization_progress")
data class MemorizationProgress(
    @PrimaryKey val globalAyahNumber: Int,
    val surahNumber: Int,
    val numberInSurah: Int,
    val status: MemorizationStatus = MemorizationStatus.NOT_STARTED,
    val repetitions: Int = 0,
    val lastReviewedAt: Long = 0L,
    val correctCount: Int = 0,
    val wrongCount: Int = 0
)

enum class MemorizationStatus {
    NOT_STARTED,
    IN_PROGRESS,
    MEMORIZED,
    NEEDS_REVIEW
}
