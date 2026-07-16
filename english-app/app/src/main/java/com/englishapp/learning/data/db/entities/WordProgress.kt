package com.englishapp.learning.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class LearningStatus {
    NEW,
    LEARNING,
    REVIEWING,
    MASTERED
}

@Entity(tableName = "word_progress")
data class WordProgress(
    @PrimaryKey val wordId: Int,
    val status: LearningStatus = LearningStatus.NEW,
    val easeFactor: Float = 2.5f,
    val intervalDays: Int = 0,
    val repetitions: Int = 0,
    val nextReviewAt: Long = 0L,
    val lastReviewedAt: Long = 0L,
    val correctCount: Int = 0,
    val wrongCount: Int = 0
)
