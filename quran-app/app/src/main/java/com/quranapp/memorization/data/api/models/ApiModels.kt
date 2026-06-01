package com.quranapp.memorization.data.api.models

import com.google.gson.annotations.SerializedName

data class QuranApiResponse<T>(
    val code: Int,
    val status: String,
    val data: T
)

data class SurahApiModel(
    val number: Int,
    val name: String,
    @SerializedName("englishName") val englishName: String,
    @SerializedName("englishNameTranslation") val englishNameTranslation: String,
    @SerializedName("numberOfAyahs") val numberOfAyahs: Int,
    @SerializedName("revelationType") val revelationType: String
)

data class AyahApiModel(
    val number: Int,
    val text: String,
    @SerializedName("numberInSurah") val numberInSurah: Int,
    val juz: Int,
    val page: Int
)

data class SurahDetailApiModel(
    val number: Int,
    val name: String,
    @SerializedName("englishName") val englishName: String,
    @SerializedName("englishNameTranslation") val englishNameTranslation: String,
    @SerializedName("numberOfAyahs") val numberOfAyahs: Int,
    @SerializedName("revelationType") val revelationType: String,
    val ayahs: List<AyahApiModel>
)
