import { GameObjects, Input, Physics, Scene, Types } from 'phaser';

export class Player extends GameObjects.Text {
    private readonly sceneRef: Scene;

    // 地面左右移动速度，数值越大移动越快。
    private readonly groundMoveSpeed = 400;
    // 空中左右移动速度，数值越小跳跃轨迹越收敛。
    private readonly airMoveSpeed = 250;
    // 当前朝向：1 为右，-1 为左，无需手动调整。
    private facingDirection = 1;

    // 跳跃相关
    // 起跳速度，数值越大起跳越有力、跳得越高。
    private readonly jumpSpeed = 600;
    // 上升阶段重力，数值越大上升时间越短。
    private readonly riseGravity = 500;
    // 下落阶段重力，数值越大下落越快。
    private readonly fallGravity = 1500;
    // 最大连续跳跃次数。
    private maxJumpCount = 2;
    // 当前剩余跳跃次数，运行时自动更新。
    private remainingJumpCount = this.maxJumpCount;
    // 是否已经离开地面，用于判断真正落地。
    private hasLeftGround = false;

    // 冲撞/下撞
    // 下撞速度，数值越大向下冲得越快。
    private readonly dashDownSpeed = 800;
    // 横向冲刺距离，数值越大单次冲刺越远。
    private readonly dashDistance = 100;
    // 横向冲刺持续时间，单位为毫秒。
    private readonly dashDuration = 100;
    // 当前是否正在下撞，运行时自动更新。
    private dashingDown = false;
    // 横向冲刺结束时间，运行时自动计算。
    private dashEndTime = 0;

    constructor(scene: Scene, x: number, y: number) {
        // 使用 emoji 展示人物，避免依赖外部图片纹理。
        super(scene, x, y, '🏃', {
            fontSize: '48px',
        });
        this.setFlipX(true);
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

        // Body 重力会与全局重力叠加：上升不追加，下降时增强重力。
        body.setGravityY(
            body.velocity.y > 0 ? this.fallGravity : this.riseGravity,
        );
    }

    private handleMove(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;
        // 离地后降低水平速度，落地时恢复地面速度。
        const moveSpeed = body.blocked.down
            ? this.groundMoveSpeed
            : this.airMoveSpeed;

        // 左
        if (cursors.left.isDown) {
            this.facingDirection = -1;
            // 左移时翻转人物 emoji，使显示方向与移动方向一致。
            this.setFlipX(false);
            body.setVelocityX(-moveSpeed);
        }

        // 右
        if (cursors.right.isDown) {
            this.facingDirection = 1;
            this.setFlipX(true);
            body.setVelocityX(moveSpeed);
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
