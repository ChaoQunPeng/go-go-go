import { Input, Physics, Scene, Types } from "phaser";

export class Player extends Physics.Arcade.Sprite {
    private readonly sceneRef: Scene;

    private readonly playerSpeed = 300;
    private facingDirection = 1;

    // 跳跃相关
    private readonly jumpSpeed = 500;
    private readonly maxJumpCount = 2;
    private remainingJumpCount = this.maxJumpCount;
    private hasLeftGround = false;


    // 冲撞/下撞
    private readonly dashDownSpeed = 800;
    private isDashingDown = false;

    public get isDashingDownState() {
        return this.isDashingDown;
    }
    private readonly dashDistance = 200;
    private readonly dashDuration = 150;
    private dashEndTime = 0;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, "player");
        this.sceneRef = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
    }

    private get canJump() {
        return this.remainingJumpCount > 0;
    }

    private get dashSpeed() {
        return this.dashDistance / (this.dashDuration / 1000);
    }
    public get isDashing() {
        return this.sceneRef.time.now < this.dashEndTime;
    }

    update(cursors: Types.Input.Keyboard.CursorKeys) {
        this.updateState(cursors);
    }

    private updateState(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;
        const isGrounded = body.blocked.down;

        if (this.y > 700) {
            // this.respawnPlayer();
            return;
        }

        if (Input.Keyboard.JustDown(cursors.space)) {
            this.dashEndTime = this.sceneRef.time.now + this.dashDuration;
        }

        // body.setCollideWorldBounds(true);
        body.setVelocityX(0);

        // 玩家真正进入空中
        if (!isGrounded) {
            this.hasLeftGround = true;
        }

        // 真正落地恢复跳跃次数
        if (isGrounded && this.hasLeftGround) {
            this.remainingJumpCount = this.maxJumpCount;

            this.hasLeftGround = false;
        }

        // 二段跳
        if (Input.Keyboard.JustDown(cursors.up) && this.canJump) {
            body.setVelocityY(-this.jumpSpeed);

            this.remainingJumpCount--;
        }

        // 下
        if (cursors.down.isDown && !isGrounded) {
            this.isDashingDown = true;
            body.setVelocityY(this.dashDownSpeed);
        } else {
            this.isDashingDown = false;
        }

        // 左
        if (cursors.left.isDown) {
            this.facingDirection = -1;
            body.setVelocityX(-this.playerSpeed);
        }

        // 右
        if (cursors.right.isDown) {
            this.facingDirection = 1;
            body.setVelocityX(this.playerSpeed);
        }

        // 冲刺期间每帧保持速度，避免被每帧重置速度抵消。
        if (this.isDashing) {
            body.setVelocityX(this.dashSpeed * this.facingDirection);
        }
    }

    private respawnPlayer() {
        const body = this.body as Phaser.Physics.Arcade.Body;

        // 停止所有速度
        body.setVelocity(0, 0);

        this.remainingJumpCount = this.maxJumpCount;

        this.hasLeftGround = false;

        // 回到出生点
        // this.setPosition(this.playerSpawnX, this.playerSpawnY);
    }
}