package com.englishapp.learning.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.englishapp.learning.data.db.entities.WordEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface WordDao {

    @Query("SELECT * FROM words ORDER BY id ASC")
    fun getAllWords(): Flow<List<WordEntity>>

    @Query("SELECT * FROM words WHERE category = :category ORDER BY id ASC")
    fun getWordsByCategory(category: String): Flow<List<WordEntity>>

    @Query("SELECT DISTINCT category FROM words ORDER BY category ASC")
    fun getCategories(): Flow<List<String>>

    @Query("SELECT * FROM words WHERE id = :wordId LIMIT 1")
    suspend fun getWord(wordId: Int): WordEntity?

    @Query("SELECT * FROM words WHERE id != :excludeId ORDER BY RANDOM() LIMIT :limit")
    suspend fun getRandomWords(excludeId: Int, limit: Int): List<WordEntity>

    @Query("SELECT COUNT(*) FROM words")
    suspend fun getWordCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertWords(words: List<WordEntity>)
}
