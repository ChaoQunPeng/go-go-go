import { GameObjects, Scene } from 'phaser';

export class ScoreManager {
    private score = 0;
    private scoreText: GameObjects.Text;

    constructor(private scene: Scene) {
    }

    create() {
        // 将分数固定在画布顶部中间位置。
        this.scoreText = this.scene.add
            .text(this.scene.cameras.main.centerX, 50, '0', {
                fontSize: '32px',
                color: '#000000',
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(1000);
    }

    update(scrollDistance: number) {
        // 每滚动 10 像素增加 1 分。
        this.score += scrollDistance / 10;
        this.renderScore();
    }

    // 向结算页面提供当前的整数分数。
    public getScore() {
        return Math.floor(this.score);
    }

    private renderScore() {
        this.scoreText.setText(this.getScore().toString());
    }
}
