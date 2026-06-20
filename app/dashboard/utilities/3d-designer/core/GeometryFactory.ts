import * as THREE from 'three';
import { ComponentShape } from '../types/3d-designer';

export class GeometryFactory {
  private static instance: GeometryFactory;
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  
  // Shared materials for performance
  public defaultMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888, 
    roughness: 0.7, 
    metalness: 0.3 
  });
  
  public highlightMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3b82f6, 
    roughness: 0.5, 
    metalness: 0.5,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.5
  });

  private constructor() {}

  public static getInstance(): GeometryFactory {
    if (!GeometryFactory.instance) {
      GeometryFactory.instance = new GeometryFactory();
    }
    return GeometryFactory.instance;
  }

  private hashParams(shape: ComponentShape, params: Record<string, any>): string {
    return `${shape}_${JSON.stringify(params)}`;
  }

  public getGeometry(shape: ComponentShape, params: Record<string, any> = {}): THREE.BufferGeometry {
    const hash = this.hashParams(shape, params);
    
    if (this.geometryCache.has(hash)) {
      return this.geometryCache.get(hash)!;
    }

    let geom: THREE.BufferGeometry;
    
    switch (shape) {
      case 'CYLINDER':
        const radius = params.radius || 0.5;
        const length = params.length || 5;
        geom = new THREE.CylinderGeometry(radius, radius, length, 16);
        // By default, Three.js cylinders grow from the center. 
        // We might want to translate it so the base is at 0,0,0, but for now we leave it centered.
        break;
      
      case 'BOX':
        const w = params.width || 1;
        const h = params.height || 1;
        const d = params.depth || 1;
        geom = new THREE.BoxGeometry(w, h, d);
        break;
        
      case 'SPHERE':
        const r = params.radius || 0.5;
        geom = new THREE.SphereGeometry(r, 16, 16);
        break;

      default:
        geom = new THREE.BoxGeometry(1, 1, 1);
    }

    this.geometryCache.set(hash, geom);
    return geom;
  }
}
