import { GameObjects, Input, Physics, Scene, Types } from 'phaser';

export class Player extends GameObjects.Text {
    private readonly sceneRef: Scene;

    private readonly playerSpeed = 500;
    private facingDirection = 1;

    // 跳跃相关
    private readonly jumpSpeed = 500;
    private maxJumpCount = 2;
    private remainingJumpCount = this.maxJumpCount;
    private hasLeftGround = false;

    // 冲撞/下撞
    private readonly dashDownSpeed = 800;
    private readonly dashDistance = 200;
    private readonly dashDuration = 150;
    private dashingDown = false;
    private dashEndTime = 0;

    constructor(scene: Scene, x: number, y: number) {
        // 使用 emoji 展示人物，避免依赖外部图片纹理。
        super(scene, x, y, '🏃', {
            fontSize: '48px',
        });
        this.sceneRef = scene;
        this.setOrigin(0.5);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Physics.Arcade.Body;
        const bodyWidth = this.width * 0.5;
        const bodyHeight = this.height * 0.8;

        // 碰撞体横向居中、底部对齐，避免缩小后玩家陷入平台。
        body.setSize(bodyWidth, bodyHeight, false);
        body.setOffset((this.width - bodyWidth) / 2, this.height - bodyHeight);
        // 启用场景配置的世界边界碰撞，底边由场景单独开放。
        body.setCollideWorldBounds(true);
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

    public get isFacingRight() {
        // 根据玩家最后一次移动方向判断当前是否朝右。
        return this.facingDirection === 1;
    }

    public increaseMaxJumpCount() {
        // 本局永久增加上限，并立即补充一次当前可用跳跃。
        this.maxJumpCount++;
        this.remainingJumpCount++;
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
            // 左移时翻转人物 emoji，使显示方向与移动方向一致。
            this.setFlipX(false);
            body.setVelocityX(-this.playerSpeed);
        }

        // 右
        if (cursors.right.isDown) {
            this.facingDirection = 1;
            this.setFlipX(true);
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

        // 地面和空中都可以无限次冲刺。
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
