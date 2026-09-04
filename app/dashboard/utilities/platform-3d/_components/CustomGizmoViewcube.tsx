import * as React from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { useGizmoContext } from '@react-three/drei';
import { Vector3, CanvasTexture } from 'three';

const colors = {
  bg: '#f0f0f0',
  hover: '#999',
  text: 'black',
  stroke: 'black'
};

const defaultFaces = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back'];
const defaultFacesColors = ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e8baff'];

const makePositionVector = (xyz: number[]) => new Vector3(...xyz).multiplyScalar(0.38);

const corners = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], 
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
].map(makePositionVector);

const cornerDimensions: [number, number, number] = [0.25, 0.25, 0.25];

const edges = [
  [1, 1, 0], [1, 0, 1], [1, 0, -1], [1, -1, 0], 
  [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1], 
  [-1, 1, 0], [-1, 0, 1], [-1, 0, -1], [-1, -1, 0]
].map(makePositionVector);

const edgeDimensions: [number, number, number][] = edges.map((edge) => 
  edge.toArray().map((axis) => (axis == 0 ? 0.5 : 0.25)) as [number, number, number]
);

type CustomGizmoProps = {
  font?: string;
  opacity?: number;
  color?: string;
  facesColor?: string[];
  hoverColor?: string;
  textColor?: string;
  strokeColor?: string;
  onClick?: (e: ThreeEvent<MouseEvent>) => null;
  faces?: string[];
};

const FaceMaterial = ({
  hover,
  index,
  font = '20px Inter var, Arial, sans-serif',
  faces = defaultFaces,
  color = colors.bg,
  facesColor = defaultFacesColors,
  hoverColor = colors.hover,
  textColor = colors.text,
  strokeColor = colors.stroke,
  opacity = 1
}: any) => {
  const gl = useThree((state) => state.gl);
  
  const texture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return null;
    
    // Use the specific face color if provided, else use general color
    const faceColor = (facesColor && facesColor.length > index) ? facesColor[index] : color;
    
    context.fillStyle = faceColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = strokeColor;
    context.strokeRect(0, 0, canvas.width, canvas.height);
    context.font = font;
    context.textAlign = 'center';
    context.fillStyle = textColor;
    context.fillText(faces[index].toUpperCase(), 64, 76);
    return new CanvasTexture(canvas);
  }, [index, faces, font, color, facesColor, textColor, strokeColor]);

  if (!texture) return null;

  return (
    <meshBasicMaterial
      map={texture}
      map-anisotropy={gl.capabilities.getMaxAnisotropy() || 1}
      attach={`material-${index}`}
      color={hover ? hoverColor : 'white'}
      transparent={true}
      opacity={opacity}
    />
  );
};

const FaceCube = (props: any) => {
  const { tweenCamera } = useGizmoContext();
  const [hover, setHover] = React.useState<number | null>(null);
  
  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHover(null);
  };
  
  const handleClick = (e: any) => {
    e.stopPropagation();
    tweenCamera(e.face.normal);
  };
  
  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    setHover(Math.floor(e.faceIndex / 2));
  };
  
  return (
    <mesh
      onPointerOut={handlePointerOut}
      onPointerMove={handlePointerMove}
      onClick={props.onClick || handleClick}
    >
      {[...Array(6)].map((_, index) => (
        <FaceMaterial
          key={index}
          index={index}
          hover={hover === index}
          {...props}
        />
      ))}
      <boxGeometry />
    </mesh>
  );
};

const EdgeCube = ({ onClick, dimensions, position, hoverColor = colors.hover }: any) => {
  const { tweenCamera } = useGizmoContext();
  const [hover, setHover] = React.useState(false);
  
  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHover(false);
  };
  
  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHover(true);
  };
  
  const handleClick = (e: any) => {
    e.stopPropagation();
    tweenCamera(position);
  };
  
  return (
    <mesh
      scale={1.01}
      position={position}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={onClick || handleClick}
    >
      <meshBasicMaterial
        color={hover ? hoverColor : 'white'}
        transparent={true}
        opacity={0.6}
        visible={hover}
      />
      <boxGeometry args={dimensions} />
    </mesh>
  );
};

export const CustomGizmoViewcube = (props: CustomGizmoProps) => {
  return (
    <group scale={[60, 60, 60]}>
      <FaceCube {...props} />
      {edges.map((edge, index) => (
        <EdgeCube
          key={index}
          position={edge}
          dimensions={edgeDimensions[index]}
          {...props}
        />
      ))}
      {corners.map((corner, index) => (
        <EdgeCube
          key={index}
          position={corner}
          dimensions={cornerDimensions}
          {...props}
        />
      ))}
    </group>
  );
};
