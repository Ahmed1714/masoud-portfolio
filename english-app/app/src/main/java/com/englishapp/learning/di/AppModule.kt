package com.englishapp.learning.di

import android.content.Context
import androidx.room.Room
import com.englishapp.learning.data.db.AppDatabase
import com.englishapp.learning.data.db.dao.ProgressDao
import com.englishapp.learning.data.db.dao.WordDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "english_master.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideWordDao(db: AppDatabase): WordDao = db.wordDao()

    @Provides
    fun provideProgressDao(db: AppDatabase): ProgressDao = db.progressDao()
}
