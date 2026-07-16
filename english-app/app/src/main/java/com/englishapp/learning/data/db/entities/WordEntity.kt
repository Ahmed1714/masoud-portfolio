package com.englishapp.learning.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "words")
data class WordEntity(
    @PrimaryKey val id: Int,
    val english: String,
    val translation: String,
    val exampleSentence: String,
    val category: String,
    val level: String
)
