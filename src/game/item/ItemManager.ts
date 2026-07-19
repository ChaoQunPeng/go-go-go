import { GameObjects, Physics, Scene } from 'phaser';
import { Player } from '../player/player.ts';

type ItemType = 'jump' | 'dash';

const itemLabels: Record<ItemType, string> = {
    jump: '跳',
    dash: '冲',
};

const itemColors: Record<ItemType, string> = {
    jump: '#0284c7',
    dash: '#ea580c',
};

export class ItemManager {
    private items: GameObjects.Text[] = [];

    constructor(
        private scene: Scene,
        private player: Player,
    ) { }

    create() {
        // 统一注册玩家与道具的拾取检测。
        this.scene.physics.add.overlap(
            this.player,
            this.items,
            this.collectItem,
            undefined,
            this,
        );
    }

    update(scrollDistance: number) {
        for (const item of this.items) {
            item.x -= scrollDistance;

            // 静态刚体需要在道具移动后同步显示位置。
            const body = item.body as Physics.Arcade.StaticBody;
            body.updateFromGameObject();
        }

        this.removeOffscreenItems();
    }

    add(x: number, platformY: number) {
        // 当前只生成跳跃道具，保留类型配置便于后续扩展。
        const type: ItemType = 'jump';
        const item = this.scene.add
            .text(x, platformY - 100, itemLabels[type], {
                fontSize: '28px',
                color: '#ffffff',
                backgroundColor: itemColors[type],
                padding: {
                    x: 8,
                    y: 6,
                },
            })
            .setOrigin(0.5);

        item.setData('itemType', type);
        this.scene.physics.add.existing(item, true);
        this.items.push(item);
    }

    private collectItem(_player: unknown, item: unknown) {
        // Phaser 回调类型较宽，这里只把道具当成文字对象处理。
        const itemObject = item as GameObjects.Text;
        const type = itemObject.getData('itemType') as ItemType;

        if (type === 'jump') {
            this.player.increaseMaxJumpCount();
        }

        itemObject.destroy();
        const index = this.items.indexOf(itemObject);

        if (index !== -1) {
            this.items.splice(index, 1);
        }
    }

    private removeOffscreenItems() {
        while (this.items.length > 0) {
            const item = this.items[0];

            if (item.x > -100) {
                break;
            }

            item.destroy();
            this.items.shift();
        }
    }
}
