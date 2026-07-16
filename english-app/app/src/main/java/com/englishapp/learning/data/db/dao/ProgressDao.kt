package com.englishapp.learning.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.englishapp.learning.data.db.entities.LearningStatus
import com.englishapp.learning.data.db.entities.WordProgress
import kotlinx.coroutines.flow.Flow

@Dao
interface ProgressDao {

    @Query("SELECT * FROM word_progress WHERE wordId = :wordId LIMIT 1")
    suspend fun getProgress(wordId: Int): WordProgress?

    @Query("SELECT * FROM word_progress")
    fun getAllProgress(): Flow<List<WordProgress>>

    @Query("SELECT * FROM word_progress WHERE nextReviewAt <= :now AND status != 'NEW' ORDER BY nextReviewAt ASC")
    fun getWordsDueForReview(now: Long): Flow<List<WordProgress>>

    @Query("SELECT COUNT(*) FROM word_progress WHERE nextReviewAt <= :now AND status != 'NEW'")
    fun getDueCount(now: Long): Flow<Int>

    @Query("SELECT COUNT(*) FROM word_progress WHERE status = :status")
    fun getCountByStatus(status: LearningStatus): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProgress(progress: WordProgress)

    @Query("SELECT COUNT(*) FROM word_progress")
    fun getTrackedCount(): Flow<Int>
}
