import * as THREE from 'three';
import { generatePlatform3DCoordinates } from '../utils/platform-3d-math';

// Sample mock platform
const platform = {
  plat_id: 1,
  title: 'TEST-PLATFORM',
  legs: 4,
  seabed: -50,
  walkway: 15,
};

const elevations = [
  { plat_id: 1, elv: '10.0', elv_name: '+10.0M' },
  { plat_id: 1, elv: '0.0', elv_name: 'EL 0.0M' },
  { plat_id: 1, elv: '-20.0', elv_name: '-20.0M' },
  { plat_id: 1, elv: '-40.0', elv_name: '-40.0M' },
];

const faces: any[] = [];

const components: any[] = [
  // Primary Legs
  { id: 1, q_id: 'LEG-A1', code: 'LG', metadata: { s_leg: 'A1', elv_1: '10.0', elv_2: '-50.0' } },
  { id: 2, q_id: 'LEG-A2', code: 'LG', metadata: { s_leg: 'A2', elv_1: '10.0', elv_2: '-50.0' } },
  { id: 3, q_id: 'LEG-B1', code: 'LG', metadata: { s_leg: 'B1', elv_1: '10.0', elv_2: '-50.0' } },
  { id: 4, q_id: 'LEG-B2', code: 'LG', metadata: { s_leg: 'B2', elv_1: '10.0', elv_2: '-50.0' } },

  // Framing Members with Nodes
  { id: 10, q_id: 'HM-1', code: 'HM', metadata: { s_node: '101', f_node: '102', s_leg: 'A1', f_leg: 'A2', elv_1: '-20.0', elv_2: '-20.0' } },
  { id: 11, q_id: 'HM-2', code: 'HM', metadata: { s_node: '103', f_node: '104', s_leg: 'B1', f_leg: 'B2', elv_1: '-20.0', elv_2: '-20.0' } },

  // Case A: Guide Bucket with SAME start and end node
  {
    id: 100,
    q_id: 'CB-SAME-NODE',
    code: 'CB',
    metadata: {
      s_node: '101',
      f_node: '101',
      elv_1: '-20.0'
    }
  },

  // Case B: Guide Bucket with DIFFERENT start and end node (Midpoint)
  {
    id: 101,
    q_id: 'CB-DIFF-NODES',
    code: 'CB',
    metadata: {
      s_node: '101',
      f_node: '102',
      elv_1: '-20.0'
    }
  },

  // Parent Conductor
  {
    id: 50,
    q_id: 'CD-1',
    code: 'CD',
    metadata: {
      s_node: '101',
      f_node: '102',
      elv_1: '10.0',
      elv_2: '-50.0'
    }
  },

  // Case C: Guide Bucket attached to Conductor via associated_comp_id
  {
    id: 102,
    q_id: 'CB-ATTACHED-CD',
    code: 'CB',
    metadata: {
      associated_comp_id: 50,
      elv_1: '-20.0'
    }
  },

  // Conductor 8 and its CGF framing
  {
    id: 58,
    q_id: 'CD08',
    code: 'CD',
    metadata: {
      elv_1: '10.0',
      elv_2: '-50.0'
    }
  },
  {
    id: 60,
    q_id: 'CGF-08',
    code: 'CF',
    metadata: {
      s_node: '103',
      f_node: '104',
      elv_1: '-30.0',
      elv_2: '-30.0'
    }
  },

  // Case D: CD08-SUPP-30 with associated_comp_id and elv_1 = -30.0
  {
    id: 103,
    q_id: 'CD08-SUPP-30',
    code: 'SUPP',
    metadata: {
      associated_comp_id: 58,
      elv_1: '-30.0'
    }
  },

  // Case E: CD08-SUPP-30 without associated_comp_id (resolved by QID prefix and elevation parsed from name)
  {
    id: 104,
    q_id: 'CD08-SUPP-30-AUTO',
    code: 'WP',
    metadata: {}
  }
];

function runTest() {
  console.log('--- Running Platform 3D Math Coordinate Generation ---');
  const result = generatePlatform3DCoordinates(platform, elevations, faces, components);
  
  const cbSame = result.componentLayouts.find((c: any) => (c.q_id || c.component?.q_id) === 'CB-SAME-NODE');
  const cbDiff = result.componentLayouts.find((c: any) => (c.q_id || c.component?.q_id) === 'CB-DIFF-NODES');
  const cbAttach = result.componentLayouts.find((c: any) => (c.q_id || c.component?.q_id) === 'CB-ATTACHED-CD');
  const cbSupp30 = result.componentLayouts.find((c: any) => (c.q_id || c.component?.q_id) === 'CD08-SUPP-30');
  const cbSuppAuto = result.componentLayouts.find((c: any) => (c.q_id || c.component?.q_id) === 'CD08-SUPP-30-AUTO');

  console.log('1. CB-SAME-NODE layout:', {
    start: cbSame?.start,
    end: cbSame?.end,
    thickness: cbSame?.thickness
  });

  console.log('2. CB-DIFF-NODES (Midpoint) layout:', {
    start: cbDiff?.start,
    end: cbDiff?.end,
    thickness: cbDiff?.thickness
  });

  console.log('3. CB-ATTACHED-CD layout:', {
    start: cbAttach?.start,
    end: cbAttach?.end,
    thickness: cbAttach?.thickness
  });

  console.log('4. CD08-SUPP-30 layout:', {
    start: cbSupp30?.start,
    end: cbSupp30?.end,
    thickness: cbSupp30?.thickness
  });

  console.log('5. CD08-SUPP-30-AUTO layout:', {
    start: cbSuppAuto?.start,
    end: cbSuppAuto?.end,
    thickness: cbSuppAuto?.thickness
  });

  if (!cbSame || !cbDiff || !cbAttach || !cbSupp30 || !cbSuppAuto) {
    throw new Error('Failed to resolve all CB test cases');
  }

  const getY = (pt: any) => Array.isArray(pt) ? pt[1] : (pt?.y ?? 0);

  // Verify Y coordinate matches elv_1 = -20.0 / -30.0
  if (Math.abs(getY(cbSame.start) - (-20.0)) > 0.001) {
    throw new Error(`Expected Y = -20.0 for cbSame, got ${getY(cbSame.start)}`);
  }
  if (Math.abs(getY(cbDiff.start) - (-20.0)) > 0.001) {
    throw new Error(`Expected Y = -20.0 for cbDiff, got ${getY(cbDiff.start)}`);
  }
  if (Math.abs(getY(cbAttach.start) - (-20.0)) > 0.001) {
    throw new Error(`Expected Y = -20.0 for cbAttach, got ${getY(cbAttach.start)}`);
  }
  if (Math.abs(getY(cbSupp30.start) - (-30.0)) > 0.001) {
    throw new Error(`Expected Y = -30.0 for cbSupp30, got ${getY(cbSupp30.start)}`);
  }
  if (Math.abs(getY(cbSuppAuto.start) - (-30.0)) > 0.001) {
    throw new Error(`Expected Y = -30.0 for cbSuppAuto, got ${getY(cbSuppAuto.start)}`);
  }

  console.log('\nAll 3D coordinate math checks PASSED successfully!');
}

runTest();

