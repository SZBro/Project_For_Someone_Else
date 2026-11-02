import Phaser from 'phaser';
import { audio } from '../audio.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const menu = document.getElementById('pause-menu');
    const resume = document.getElementById('resume');
    const soundVolume = document.getElementById('sound-volume');
    const musicVolume = document.getElementById('music-volume');
    const soundVolumeValue = document.getElementById('sound-volume-value');
    const musicVolumeValue = document.getElementById('music-volume-value');
    menu.hidden = false;
    soundVolume.value = audio.soundVolume;
    musicVolume.value = audio.musicVolume;
    this.updateVolumeLabel(soundVolumeValue, audio.soundVolume);
    this.updateVolumeLabel(musicVolumeValue, audio.musicVolume);
    soundVolume.oninput = () => {
      audio.setSoundVolume(soundVolume.value);
      this.updateVolumeLabel(soundVolumeValue, audio.soundVolume);
    };
    musicVolume.oninput = () => {
      audio.setMusicVolume(musicVolume.value);
      this.updateVolumeLabel(musicVolumeValue, audio.musicVolume);
    };
    resume.onclick = () => this.resumeGame();
    resume.focus();
    this.input.keyboard.on('keydown-ESC', this.resumeGame, this);

    this.events.once('shutdown', () => {
      menu.hidden = true;
      resume.onclick = null;
      soundVolume.oninput = null;
      musicVolume.oninput = null;
    });
  }

  updateVolumeLabel(label, volume) {
    label.value = `${Math.round(volume * 100)}%`;
  }

  resumeGame() {
    this.scene.stop();
    this.scene.resume('Game');
    this.scene.resume('UI');
  }
}
