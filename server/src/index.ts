import { Socket, Server } from 'socket.io'
import { PhysicsBody, PhysicsWorld, tickPhysicsBody } from '../../core/physics'
import { Vector2 } from '../../core/vector2'

const PLAYER_INPUT_ACCELERATION = 1000

interface Player extends PhysicsBody {
  id: string,
  moveInput: Vector2,
  lookRot: number
}

class ServerWorld implements PhysicsWorld {
  public players: Record<string, Player>
  private _bodies: PhysicsBody[]

  constructor() {
    this.players = {}
    this._bodies = []
  }

  public get bodies(): PhysicsBody[] {
    return [...Object.values(this.players), ...this._bodies]
  }

  public addBody(body: PhysicsBody) {
    this._bodies.push(body)
  }

  public removeBody(body: PhysicsBody) {
    this._bodies = this._bodies.filter((b) => b !== body)
  }
}

const io = new Server({
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

const world = new ServerWorld()

io.on("connection", (socket: Socket) => {
  // setup intial data
  world.players[socket.id] = {
    id: socket.id,
    position: {x: 0, y: 0},
    velocity: {x: 0, y: 0},
    acceleration: {x: 0, y: 0},
    rotation: 0,
    radius: 20,
    moveInput: {x: 0, y: 0},
    lookRot: 0,
    dragScale: 0.8
  }

  // emit initial data
  io.emit('playerJoin', socket.id)

  // handle disconnect
  socket.on('disconnect', () => {
    delete world.players[socket.id]
    io.emit('playerLeft', socket.id)
  })

  // handle input
  socket.on('playerInput', (input) => {
    world.players[socket.id].moveInput = input.moveInput
    world.players[socket.id].lookRot = input.lookRot
  })
})

io.listen(3001)

const physicsTickRate = 1000/60
const networkTickRate = 45
let lastPhysicsUpdate = Date.now()

const physicsLoop = () => {
  const now = Date.now()
  const delta = (now - lastPhysicsUpdate ) / 1000
  lastPhysicsUpdate = now

  for (let player of Object.values(world.players)) {
    player.acceleration.x = player.moveInput.x * PLAYER_INPUT_ACCELERATION
    player.acceleration.y = player.moveInput.y * PLAYER_INPUT_ACCELERATION
    player.rotation = player.lookRot
  }
  
  for(let body of world.bodies) {
    tickPhysicsBody(body, world, delta)
  }
}

const clientUpdateLoop = () => {
  io.emit('playersSync', {
    players: Object.values(world.players).map((player) => {return {id: player.id, position: player.position, rotation: player.rotation}}),
    time: Date.now()
  })
}
setInterval(physicsLoop, physicsTickRate)

setInterval(clientUpdateLoop, networkTickRate)