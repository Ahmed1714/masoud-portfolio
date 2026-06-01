package com.quranapp.memorization.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.quranapp.memorization.data.db.dao.ProgressDao
import com.quranapp.memorization.data.db.dao.SurahDao
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.db.entities.CachedSurah
import com.quranapp.memorization.data.db.entities.MemorizationProgress
import com.quranapp.memorization.data.db.entities.MemorizationStatus

class MemorizationStatusConverter {
    @TypeConverter
    fun fromStatus(status: MemorizationStatus): String = status.name
    @TypeConverter
    fun toStatus(name: String): MemorizationStatus = MemorizationStatus.valueOf(name)
}

@Database(
    entities = [CachedSurah::class, CachedAyah::class, MemorizationProgress::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(MemorizationStatusConverter::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun surahDao(): SurahDao
    abstract fun progressDao(): ProgressDao
}
