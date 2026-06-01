package com.quranapp.memorization.data.db.dao

import androidx.room.*
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.CachedSurah
import kotlinx.coroutines.flow.Flow

@Dao
interface SurahDao {

    @Query("SELECT * FROM surahs ORDER BY number ASC")
    fun getAllSurahs(): Flow<List<CachedSurah>>

    @Query("SELECT * FROM surahs WHERE number = :number LIMIT 1")
    suspend fun getSurahByNumber(number: Int): CachedSurah?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSurahs(surahs: List<CachedSurah>)

    @Query("SELECT COUNT(*) FROM surahs")
    suspend fun getSurahCount(): Int

    @Query("SELECT * FROM ayahs WHERE surahNumber = :surahNumber ORDER BY numberInSurah ASC")
    fun getAyahsForSurah(surahNumber: Int): Flow<List<CachedAyah>>

    @Query("SELECT * FROM ayahs WHERE globalNumber = :globalNumber LIMIT 1")
    suspend fun getAyahByGlobalNumber(globalNumber: Int): CachedAyah?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAyahs(ayahs: List<CachedAyah>)

    @Query("SELECT COUNT(*) FROM ayahs WHERE surahNumber = :surahNumber")
    suspend fun getAyahCountForSurah(surahNumber: Int): Int
}
