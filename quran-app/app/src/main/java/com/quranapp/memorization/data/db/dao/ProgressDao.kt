package com.quranapp.memorization.data.db.dao

import androidx.room.*
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface ProgressDao {

    @Query("SELECT * FROM memorization_progress WHERE globalAyahNumber = :globalAyahNumber LIMIT 1")
    suspend fun getProgress(globalAyahNumber: Int): MemorizationProgress?

    @Query("SELECT * FROM memorization_progress WHERE surahNumber = :surahNumber ORDER BY numberInSurah ASC")
    fun getProgressForSurah(surahNumber: Int): Flow<List<MemorizationProgress>>

    @Query("SELECT * FROM memorization_progress ORDER BY lastReviewedAt DESC")
    fun getAllProgress(): Flow<List<MemorizationProgress>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProgress(progress: MemorizationProgress)

    @Query("""
        UPDATE memorization_progress
        SET status = :status, repetitions = repetitions + 1, lastReviewedAt = :timestamp,
            correctCount = CASE WHEN :isCorrect = 1 THEN correctCount + 1 ELSE correctCount END,
            wrongCount = CASE WHEN :isCorrect = 0 THEN wrongCount + 1 ELSE wrongCount END
        WHERE globalAyahNumber = :globalAyahNumber
    """)
    suspend fun updateReview(
        globalAyahNumber: Int,
        status: MemorizationStatus,
        timestamp: Long,
        isCorrect: Boolean
    )

    @Query("SELECT COUNT(*) FROM memorization_progress WHERE status = :status")
    fun getCountByStatus(status: MemorizationStatus): Flow<Int>

    @Query("SELECT COUNT(*) FROM memorization_progress WHERE surahNumber = :surahNumber AND status = :status")
    suspend fun getCountForSurahByStatus(surahNumber: Int, status: MemorizationStatus): Int

    @Query("SELECT COUNT(DISTINCT surahNumber) FROM memorization_progress WHERE status = 'MEMORIZED'")
    fun getMemorizedSurahCount(): Flow<Int>

    @Query("SELECT * FROM memorization_progress WHERE lastReviewedAt < :cutoffTime AND status != 'NOT_STARTED' ORDER BY lastReviewedAt ASC LIMIT 10")
    fun getAyahsDueForReview(cutoffTime: Long): Flow<List<MemorizationProgress>>
}
