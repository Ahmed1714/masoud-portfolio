package com.englishapp.learning.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.englishapp.learning.data.db.dao.ProgressDao
import com.englishapp.learning.data.db.dao.WordDao
import com.englishapp.learning.data.db.entities.LearningStatus
import com.englishapp.learning.data.db.entities.WordEntity
import com.englishapp.learning.data.db.entities.WordProgress

class LearningStatusConverter {
    @TypeConverter
    fun fromStatus(status: LearningStatus): String = status.name
    @TypeConverter
    fun toStatus(name: String): LearningStatus = LearningStatus.valueOf(name)
}

@Database(
    entities = [WordEntity::class, WordProgress::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(LearningStatusConverter::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun wordDao(): WordDao
    abstract fun progressDao(): ProgressDao
}
