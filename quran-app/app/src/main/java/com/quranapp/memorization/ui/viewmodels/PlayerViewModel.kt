package com.quranapp.memorization.ui.viewmodels

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.quranapp.memorization.data.db.entities.CachedAyah
import com.quranapp.memorization.data.repository.QuranRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class RecitationMode { MURATTAL, MUJAWWAD }
enum class RepeatMode { NONE, SINGLE, ALL }

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val repository: QuranRepository
) : ViewModel() {

    private var player: ExoPlayer? = null

    private val _ayahs = MutableStateFlow<List<CachedAyah>>(emptyList())
    val ayahs: StateFlow<List<CachedAyah>> = _ayahs.asStateFlow()

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _progress = MutableStateFlow(0f)
    val progress: StateFlow<Float> = _progress.asStateFlow()

    private val _playbackSpeed = MutableStateFlow(1.0f)
    val playbackSpeed: StateFlow<Float> = _playbackSpeed.asStateFlow()

    private val _repeatMode = MutableStateFlow(RepeatMode.NONE)
    val repeatMode: StateFlow<RepeatMode> = _repeatMode.asStateFlow()

    private val _recitationMode = MutableStateFlow(RecitationMode.MURATTAL)
    val recitationMode: StateFlow<RecitationMode> = _recitationMode.asStateFlow()

    private var progressJob: Job? = null

    fun initialize(context: Context, ayahs: List<CachedAyah>, startIndex: Int = 0) {
        _ayahs.value = ayahs
        _currentIndex.value = startIndex
        setupPlayer(context)
    }

    private fun setupPlayer(context: Context) {
        player?.release()
        player = ExoPlayer.Builder(context).build().also { exo ->
            exo.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    when (state) {
                        Player.STATE_ENDED -> onAyahEnded()
                        Player.STATE_READY -> startProgressTracking()
                        else -> {}
                    }
                }
                override fun onIsPlayingChanged(playing: Boolean) {
                    _isPlaying.value = playing
                    if (playing) startProgressTracking() else stopProgressTracking()
                }
            })
        }
    }

    private fun onAyahEnded() {
        when (_repeatMode.value) {
            RepeatMode.SINGLE -> playCurrentAyah()
            RepeatMode.ALL -> {
                val next = (_currentIndex.value + 1) % _ayahs.value.size
                _currentIndex.value = next
                playCurrentAyah()
            }
            RepeatMode.NONE -> {
                val next = _currentIndex.value + 1
                if (next < _ayahs.value.size) {
                    _currentIndex.value = next
                    playCurrentAyah()
                } else {
                    _isPlaying.value = false
                    _progress.value = 0f
                }
            }
        }
    }

    private fun startProgressTracking() {
        progressJob?.cancel()
        progressJob = viewModelScope.launch {
            while (true) {
                player?.let { exo ->
                    val duration = exo.duration
                    val position = exo.currentPosition
                    if (duration > 0) _progress.value = position.toFloat() / duration.toFloat()
                }
                delay(200)
            }
        }
    }

    private fun stopProgressTracking() { progressJob?.cancel() }

    fun playCurrentAyah() {
        val ayahs = _ayahs.value
        if (ayahs.isEmpty()) return
        val ayah = ayahs[_currentIndex.value]
        val useMujawwad = _recitationMode.value == RecitationMode.MUJAWWAD
        val url = repository.getAudioUrl(ayah.globalNumber, useMujawwad)
        player?.let { exo ->
            exo.setMediaItem(MediaItem.fromUri(url))
            exo.playbackParameters = exo.playbackParameters.withSpeed(_playbackSpeed.value)
            exo.prepare()
            exo.play()
        }
    }

    fun togglePlayPause() {
        player?.let { exo ->
            if (exo.isPlaying) exo.pause() else {
                if (exo.playbackState == Player.STATE_IDLE || exo.playbackState == Player.STATE_ENDED) {
                    playCurrentAyah()
                } else {
                    exo.play()
                }
            }
        }
    }

    fun seekToAyah(index: Int) {
        _currentIndex.value = index
        playCurrentAyah()
    }

    fun nextAyah() {
        val next = _currentIndex.value + 1
        if (next < _ayahs.value.size) { _currentIndex.value = next; playCurrentAyah() }
    }

    fun previousAyah() {
        val prev = _currentIndex.value - 1
        if (prev >= 0) { _currentIndex.value = prev; playCurrentAyah() }
    }

    fun seekTo(fraction: Float) {
        player?.let { exo ->
            val duration = exo.duration
            if (duration > 0) exo.seekTo((duration * fraction).toLong())
        }
    }

    fun setSpeed(speed: Float) {
        _playbackSpeed.value = speed
        player?.playbackParameters = player?.playbackParameters?.withSpeed(speed)
            ?: return
    }

    fun cycleRepeatMode() {
        _repeatMode.value = when (_repeatMode.value) {
            RepeatMode.NONE -> RepeatMode.SINGLE
            RepeatMode.SINGLE -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.NONE
        }
    }

    fun toggleRecitationMode() {
        _recitationMode.value = if (_recitationMode.value == RecitationMode.MURATTAL)
            RecitationMode.MUJAWWAD else RecitationMode.MURATTAL
    }

    override fun onCleared() {
        super.onCleared()
        progressJob?.cancel()
        player?.release()
        player = null
    }
}
