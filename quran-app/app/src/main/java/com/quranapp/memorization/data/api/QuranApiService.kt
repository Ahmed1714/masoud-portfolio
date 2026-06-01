package com.quranapp.memorization.data.api

import com.quranapp.memorization.data.api.models.QuranApiResponse
import com.quranapp.memorization.data.api.models.SurahApiModel
import com.quranapp.memorization.data.api.models.SurahDetailApiModel
import retrofit2.http.GET
import retrofit2.http.Path

interface QuranApiService {

    @GET("surah")
    suspend fun getAllSurahs(): QuranApiResponse<List<SurahApiModel>>

    // ar.asem = Hafs Asem (standard Mushaf text)
    @GET("surah/{number}/ar.asem")
    suspend fun getSurahWithText(
        @Path("number") surahNumber: Int
    ): QuranApiResponse<SurahDetailApiModel>
}
