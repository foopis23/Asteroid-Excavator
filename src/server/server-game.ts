import { Server, Socket } from "socket.io";
import { ComponentTypes, IEntityData } from "../core/components";
import { ECS } from "../core/ecs";
import { EntityType, IEntity } from "../core/entity";
import { BoundsSystem, CollisionSystem, PhysicsSystem, PlayerInputHandlerSystem } from "../core/systems";
import { TransformSyncSystem } from "./transform-sync";

export class ServerGame {
  protected ecs: ECS;
  protected socketIdToPlayerEntityId: Map<string, number>;
  protected lastTick: number;
  private intervalHandle: NodeJS.Timer;

  constructor(protected serverSocket: Server, SERVER_TICK_RATE: number) {
    this.ecs = new ECS(
      new PlayerInputHandlerSystem(),
      new PhysicsSystem(),
      new CollisionSystem(),
      new TransformSyncSystem(1 / 30, serverSocket),
      // TODO: hook up with configurable map size
      new BoundsSystem({ x: 0, y: 0, w: 1440, h: 1080 })
    );
    this.socketIdToPlayerEntityId = new Map<string, number>();

    for (const socketEntry of this.serverSocket.sockets.sockets) {
      const socket = socketEntry[1]
      this.spawnServerPlayerEntity(socket)
    }

    for (let i = 0; i < 10; i++) {
      this.spawnAsteroidServerEntity()
    }

    this.lastTick = Date.now();
    this.intervalHandle = setInterval(() => this.tick(), SERVER_TICK_RATE)
  }

  protected spawnAsteroidServerEntity(): IEntity {
    const radius = (Math.random() * 60) + 20
    const initialData: Partial<IEntityData> = {
      // TODO: Configurable Map Size
      position: { x: Math.random() * 1440, y: Math.random() * 1080 },
      static: false,
      maxAcceleration: 1000,
      size: { x: radius, y: radius },
      hasDrag: false,
      velocity: { x: Math.random() * 20 - 10, y: Math.random() * 20 - 10 },
      type: 'circle',
      priority: radius
    }

    const entity = this.ecs.createNewEntity(
      EntityType.Asteroid,
      initialData,
      [
        ComponentTypes.Transform,
        ComponentTypes.RigidBody,
        ComponentTypes.Collider,
        ComponentTypes.TransformSync
      ]
    )

    this.serverSocket.emit('spawnEntity', {
      entityId: entity.id,
      type: EntityType.Asteroid,
      time: Date.now(),
      initial: initialData
    })

    return entity
  }

  protected spawnServerPlayerEntity(socket: Socket): IEntity {
    const initialPlayerValues: Partial<IEntityData> = {
      static: false,
      type: 'circle',
      maxAcceleration: 1000,
      size: { x: 20, y: 20 },
      position: { x: Math.random() * 1340 + 100, y: Math.random() * 980 + 100 },
      priority: 20
    }

    const player = this.ecs.createNewEntity(
      EntityType.Player,
      initialPlayerValues,
      [
        ComponentTypes.Transform,
        ComponentTypes.PlayerInput,
        ComponentTypes.Collider,
        ComponentTypes.RigidBody
      ]
    );

    socket.emit('assignPlayerId', player.id)

    // emit initial data
    this.serverSocket.emit('spawnEntity', {
      entityId: player.id,
      type: EntityType.Player,
      time: Date.now(),
      initial: initialPlayerValues
    })

    this.socketIdToPlayerEntityId.set(socket.id, player.id)

    return player
  }

  protected tick() {
    const now = Date.now()
    const dt = (now - this.lastTick) / 1000
    this.lastTick = now
    this.ecs.update(dt)
  }

  public destroy() {
    clearInterval(this.intervalHandle)
  }
}