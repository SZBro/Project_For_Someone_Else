import Phaser from 'phaser';

const TEXT = { fontFamily: 'sans-serif', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };

// Final weigh-in, drawn over the frozen game.
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create({ results }) {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);

    const winner = results[0];
    this.add
      .text(width / 2, height * 0.2, winner.isPlayer ? 'You are the fattest bear!' : `${winner.name} wins Fat Bear Week`, {
        ...TEXT,
        fontSize: '40px',
        color: '#ffd34d',
      })
      .setOrigin(0.5);

    const lines = results.map((r, i) => `${i + 1}.  ${r.isPlayer ? 'You' : r.name}  ${r.weight} lb`).join('\n');
    this.add.text(width / 2, height * 0.3, lines, { ...TEXT, fontSize: '24px', align: 'center' }).setOrigin(0.5, 0);

    this.add
      .text(width / 2, height * 0.8, 'Press Enter or click to play again', { ...TEXT, fontSize: '22px' })
      .setOrigin(0.5);

    const restart = () => this.scene.start('Game');
    this.input.keyboard.once('keydown-ENTER', restart);
    this.input.once('pointerdown', restart);
  }
}
