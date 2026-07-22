import { GameObjects, Input, Physics, Scene, Tweens, Types } from 'phaser';

export class Player extends GameObjects.Text {
    private readonly sceneRef: Scene;
    private readonly onDashWorldAdvance: (distance: number) => void;

    // 地面和空中的水平移动速度，空中较慢以保持跳跃轨迹稳定。
    private readonly groundMoveSpeed = 400;
    private readonly airMoveSpeed = 250;
    // 当前朝向：1 为右，-1 为左。
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
    // Player 与 Camera 分阶段前进的距离，结束后结算到世界并恢复坐标基准。
    private readonly dashDistance = 100;
    // 横向冲刺持续时间，单位为毫秒。
    private readonly dashDuration = 160;
    // Dash 结束后镜头追赶玩家的时间，单位为毫秒。
    private readonly cameraCatchUpDuration = 180;
    // 当前是否正在下撞，运行时自动更新。
    private dashingDown = false;
    // 横向冲刺结束时间，运行时自动计算。
    private dashEndTime = 0;
    // 记录 Dash 临时特效，便于死亡或暂停时统一清理。
    private dashEffectObjects: GameObjects.GameObject[] = [];
    // 依次保存玩家冲刺和镜头追赶 Tween，避免两个阶段重叠。
    private dashMovementTween?: Tweens.Tween;
    private dashStartX?: number;
    private dashStartCameraScrollX?: number;

    constructor(
        scene: Scene,
        x: number,
        y: number,
        onDashWorldAdvance: (distance: number) => void,
    ) {
        // 使用 emoji 展示人物，避免依赖外部图片纹理。
        super(scene, x, y, '🏃', {
            fontSize: '48px',
        });
        this.setFlipX(true);
        this.sceneRef = scene;
        this.onDashWorldAdvance = onDashWorldAdvance;
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

    public get isDashing() {
        return this.sceneRef.time.now < this.dashEndTime;
    }

    public get worldSpeedMultiplier() {
        // 自由移动只改变玩家位置，不修改世界滚动速度。
        return 1;
    }

    public get isDashingDown() {
        return this.dashingDown;
    }

    public cancelDash() {
        // 非游玩状态优先于 Dash，立即结束计时并清理视觉状态。
        this.dashEndTime = 0;
        this.dashingDown = false;
        this.clearDashEffects();
    }

    public get isFacingRight() {
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

        // 冲刺
        this.handleDash(cursors);

        // 移动
        this.handleMove(cursors);

        // 跳
        this.handleJump(cursors);

        // 下
        this.handleDownDash(cursors, isGrounded);

        // Body 重力会与全局重力叠加：上升不追加，下降时增强重力。
        body.setGravityY(
            body.velocity.y > 0 ? this.fallGravity : this.riseGravity,
        );
    }

    private handleMove(cursors: Types.Input.Keyboard.CursorKeys) {
        const body = this.body as Physics.Arcade.Body;

        if (this.dashMovementTween?.isPlaying()) {
            // Dash 和镜头追赶期间由 Tween 接管横向坐标。
            return;
        }

        const moveSpeed = body.blocked.down
            ? this.groundMoveSpeed
            : this.airMoveSpeed;

        if (cursors.left.isDown && !cursors.right.isDown) {
            this.facingDirection = -1;
            this.setFlipX(false);
            body.setVelocityX(-moveSpeed);
            return;
        }

        if (cursors.right.isDown && !cursors.left.isDown) {
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
        // 镜头追赶完成前不重复触发，避免坐标归一化相互覆盖。
        if (
            Input.Keyboard.JustDown(cursors.space) &&
            !this.dashMovementTween?.isPlaying()
        ) {
            this.dashEndTime = this.sceneRef.time.now + this.dashDuration;
            this.playDashEffects();
        }
    }

    private playDashEffects() {
        this.clearDashEffects();
        this.setScale(1.32, 0.78);
        this.startDashMovement();

        // 位移和压缩拉伸使用相同时间，统一结束 Dash 动画。
        this.sceneRef.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            duration: this.dashDuration,
            ease: 'Back.easeOut',
        });

        this.createDashAfterimages();
        this.createDashSpeedLines();
        this.sceneRef.cameras.main.shake(90, 0.002);
    }

    private createDashAfterimages() {
        const camera = this.sceneRef.cameras.main;
        const playerScreenX = this.x - camera.scrollX;
        const playerScreenY = this.y - camera.scrollY;

        for (let index = 1; index <= 3; index++) {
            // 残影使用屏幕坐标，避免镜头移动时改变拖尾位置。
            const afterimage = this.sceneRef.add
                .text(playerScreenX - index * 14, playerScreenY, this.text, {
                    fontSize: '48px',
                })
                .setOrigin(0.5)
                .setFlipX(true)
                .setAlpha(0.32 / index)
                .setScrollFactor(0)
                .setDepth(this.depth - 1);
            this.dashEffectObjects.push(afterimage);

            this.sceneRef.tweens.add({
                targets: afterimage,
                x: afterimage.x - 30,
                alpha: 0,
                duration: 140 + index * 35,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.destroyDashEffect(afterimage);
                },
            });
        }
    }

    private createDashSpeedLines() {
        const speedLines = this.sceneRef.add
            .graphics()
            .setScrollFactor(0)
            .setDepth(this.depth + 1);
        this.dashEffectObjects.push(speedLines);

        // 使用固定分布避免每次 Dash 的视觉强度随机变化。
        for (let index = 0; index < 7; index++) {
            const startX = 180 + (index % 3) * 70;
            const y = 100 + index * 88;

            speedLines.lineStyle(index % 2 === 0 ? 3 : 2, 0x0f766e, 0.4);
            speedLines.beginPath();
            speedLines.moveTo(startX, y);
            speedLines.lineTo(startX + 180 + index * 14, y);
            speedLines.strokePath();
        }

        this.sceneRef.tweens.add({
            targets: speedLines,
            x: -120,
            alpha: 0,
            duration: this.dashDuration,
            ease: 'Quad.easeOut',
            onComplete: () => {
                this.destroyDashEffect(speedLines);
            },
        });
    }

    private startDashMovement() {
        const camera = this.sceneRef.cameras.main;

        this.dashStartX = this.x;
        this.dashStartCameraScrollX = camera.scrollX;

        // Dash 阶段只移动玩家，让玩家先在画面中明显向前冲出。
        this.dashMovementTween = this.sceneRef.tweens.add({
            targets: this,
            x: this.dashStartX + this.dashDistance,
            duration: this.dashDuration,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.startCameraCatchUp();
            },
        });
    }

    private startCameraCatchUp() {
        if (this.dashStartCameraScrollX === undefined) {
            return;
        }

        const camera = this.sceneRef.cameras.main;

        // Dash 结束后镜头再追上玩家，使玩家平滑回到屏幕左侧。
        this.dashMovementTween = this.sceneRef.tweens.add({
            targets: camera,
            scrollX: this.dashStartCameraScrollX + this.dashDistance,
            duration: this.cameraCatchUpDuration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.completeDashMovement();
            },
        });
    }

    private completeDashMovement() {
        if (
            this.dashStartX === undefined ||
            this.dashStartCameraScrollX === undefined
        ) {
            return;
        }

        const distance = this.x - this.dashStartX;

        // 将镜头位移结算为世界滚动，再恢复固定坐标，画面不会发生跳变。
        this.onDashWorldAdvance(distance);
        this.restoreDashCoordinates();
        this.dashMovementTween = undefined;
    }

    private clearDashEffects() {
        this.dashMovementTween?.stop();
        this.dashMovementTween = undefined;
        this.restoreDashCoordinates();
        this.sceneRef.tweens.killTweensOf(this);
        this.sceneRef.cameras.main.shakeEffect.reset();
        this.setScale(1);

        for (const effect of this.dashEffectObjects) {
            this.sceneRef.tweens.killTweensOf(effect);
            effect.destroy();
        }

        this.dashEffectObjects = [];
    }

    private destroyDashEffect(effect: GameObjects.GameObject) {
        const index = this.dashEffectObjects.indexOf(effect);

        if (index !== -1) {
            this.dashEffectObjects.splice(index, 1);
        }

        effect.destroy();
    }

    private restoreDashCoordinates() {
        if (
            this.dashStartX === undefined ||
            this.dashStartCameraScrollX === undefined
        ) {
            return;
        }

        this.setX(this.dashStartX);
        this.sceneRef.cameras.main.scrollX = this.dashStartCameraScrollX;
        (this.body as Physics.Arcade.Body).updateFromGameObject();
        this.dashStartX = undefined;
        this.dashStartCameraScrollX = undefined;
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
