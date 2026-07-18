import { Input, Physics, Scene, Types } from 'phaser';

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
    private readonly dashDistance = 200;
    private readonly dashDuration = 150;
    private dashingDown = false;
    private dashEndTime = 0;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'player');
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

    public get isDashingDown() {
        return this.dashingDown;
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

        body.setVelocityX(0);

        this.updateGroundState(isGrounded);

        // 移动
        this.handleMove(cursors);

        // 跳
        this.handleJump(cursors);

        // 下
        this.handleDownDash(cursors, isGrounded);

        // 冲刺
        this.handleDash(cursors);
    }

    private handleMove(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;

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
    }

    private handleJump(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;
        if (Input.Keyboard.JustDown(cursors.up) && this.canJump) {
            body.setVelocityY(-this.jumpSpeed);

            this.remainingJumpCount--;
        }
    }

    private handleDash(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;

        // 开始冲刺
        if (Input.Keyboard.JustDown(cursors.space)) {
            this.dashEndTime = this.sceneRef.time.now + this.dashDuration;
        }

        // 冲刺期间保持速度
        if (this.isDashing) {
            body.setVelocityX(this.dashSpeed * this.facingDirection);
        }
    }

    private handleDownDash(
        cursors: Types.Input.Keyboard.CursorKeys,
        isGrounded: boolean,
    ) {
        const body = this.body as Physics.Arcade.Body;
        // 下
        if (cursors.down.isDown && !isGrounded) {
            this.dashingDown = true;
            body.setVelocityY(this.dashDownSpeed);
        } else {
            this.dashingDown = false;
        }
    }

    private updateGroundState(isGrounded: boolean) {
        // 玩家离开地面
        if (!isGrounded) {
            this.hasLeftGround = true;
        }

        // 玩家真正落地
        if (isGrounded && this.hasLeftGround) {
            this.remainingJumpCount = this.maxJumpCount;

            this.hasLeftGround = false;
        }
    }
}
