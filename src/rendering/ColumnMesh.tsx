import type { Column, Selection } from '../domain/types'
import { pointerCursor } from './pointerCursor'

export function ColumnMesh({ column, selection, select }: { column: Column; selection: Selection; select: (selection: Selection) => void }) {
  const color = column.material === 'steel' ? '#737d82' : column.material === 'timber' ? '#947557' : '#c1bdb4'
  return <mesh position={[column.position.x, column.height / 2, column.position.z]} castShadow receiveShadow
    onPointerOver={() => pointerCursor(true)} onPointerOut={() => pointerCursor(false)}
    onClick={event => { event.stopPropagation(); select({ kind: 'column', id: column.id }) }}>
    {column.shape === 'circular' ? <cylinderGeometry args={[column.diameter / 2, column.diameter / 2, column.height, 20]} />
      : <boxGeometry args={[column.width, column.height, column.depth]} />}
    <meshStandardMaterial color={selection?.id === column.id ? '#bf995e' : color} metalness={column.material === 'steel' ? .4 : .02} roughness={.76} />
  </mesh>
}
