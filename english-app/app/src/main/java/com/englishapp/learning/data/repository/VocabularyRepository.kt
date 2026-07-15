package com.englishapp.learning.data.repository

import com.englishapp.learning.data.SeedWords
import com.englishapp.learning.data.db.dao.ProgressDao
import com.englishapp.learning.data.db.dao.WordDao
import com.englishapp.learning.data.db.entities.LearningStatus
import com.englishapp.learning.data.db.entities.WordEntity
import com.englishapp.learning.data.db.entities.WordProgress
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/** Review quality on a 0-5 scale, mirroring the SM-2 spaced repetition algorithm. */
enum class ReviewQuality(val score: Int) {
    AGAIN(0),
    HARD(3),
    GOOD(4),
    EASY(5)
}

@Singleton
class VocabularyRepository @Inject constructor(
    private val wordDao: WordDao,
    private val progressDao: ProgressDao
) {

    fun getAllWords(): Flow<List<WordEntity>> = wordDao.getAllWords()

    fun getWordsByCategory(category: String): Flow<List<WordEntity>> =
        wordDao.getWordsByCategory(category)

    fun getCategories(): Flow<List<String>> = wordDao.getCategories()

    fun getAllProgress(): Flow<List<WordProgress>> = progressDao.getAllProgress()

    fun getWordsDueForReview(now: Long = System.currentTimeMillis()): Flow<List<WordProgress>> =
        progressDao.getWordsDueForReview(now)

    fun getDueCount(now: Long = System.currentTimeMillis()): Flow<Int> =
        progressDao.getDueCount(now)

    fun getCountByStatus(status: LearningStatus): Flow<Int> = progressDao.getCountByStatus(status)

    fun getTrackedCount(): Flow<Int> = progressDao.getTrackedCount()

    suspend fun seedIfNeeded() {
        if (wordDao.getWordCount() == 0) {
            wordDao.insertWords(SeedWords.words)
        }
    }

    suspend fun getWord(wordId: Int): WordEntity? = wordDao.getWord(wordId)

    suspend fun getQuizDistractors(correctWordId: Int, count: Int = 3): List<WordEntity> =
        wordDao.getRandomWords(correctWordId, count)

    /**
     * Applies the SM-2 spaced repetition update for a single review.
     * quality < 3 resets the learning streak; quality >= 3 grows the interval.
     */
    suspend fun submitReview(wordId: Int, quality: ReviewQuality) {
        val existing = progressDao.getProgress(wordId) ?: WordProgress(wordId = wordId)
        val isCorrect = quality.score >= 3

        var repetitions = existing.repetitions
        var intervalDays = existing.intervalDays
        var easeFactor = existing.easeFactor

        if (!isCorrect) {
            repetitions = 0
            intervalDays = 1
        } else {
            intervalDays = when (repetitions) {
                0 -> 1
                1 -> 6
                else -> Math.round(intervalDays * easeFactor)
            }
            repetitions += 1
        }

        val q = quality.score
        easeFactor = (easeFactor + (0.1f - (5 - q) * (0.08f + (5 - q) * 0.02f)))
            .coerceAtLeast(1.3f)

        val status = when {
            isCorrect && repetitions >= 1 && intervalDays >= 21 -> LearningStatus.MASTERED
            isCorrect -> LearningStatus.REVIEWING
            else -> LearningStatus.LEARNING
        }

        val now = System.currentTimeMillis()
        progressDao.upsertProgress(
            existing.copy(
                status = status,
                easeFactor = easeFactor,
                intervalDays = intervalDays,
                repetitions = repetitions,
                nextReviewAt = now + TimeUnit.DAYS.toMillis(intervalDays.toLong()),
                lastReviewedAt = now,
                correctCount = existing.correctCount + if (isCorrect) 1 else 0,
                wrongCount = existing.wrongCount + if (isCorrect) 0 else 1
            )
        )
    }
}
