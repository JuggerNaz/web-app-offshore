import { GuideBucket } from '../app/dashboard/utilities/platform-3d/_components/GuideBucket';

const gb = new GuideBucket({
  outerRadius: 0.28,
  height: 0.55,
  color: '#facc15'
});

console.log('GuideBucket created successfully:', gb.name, 'Number of sub-meshes:', gb.children.length);
