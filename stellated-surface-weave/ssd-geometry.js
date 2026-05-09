import * as THREE from "three";

const PHI = (Math.sqrt(5) + 1) / 2;
const INV_PHI = (Math.sqrt(5) - 1) / 2;
const FACE_STAR_RATIO = (5 - Math.sqrt(5)) / 10;
const BEND_MITER_EXTENSION_FACTOR = Math.sqrt((5 + Math.sqrt(5)) / 10);
const BEND_INNER_EXTENSION_FACTOR = Math.sqrt((5 - Math.sqrt(5)) / 10);

const DODECA_VERTICES = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
  [0, PHI, INV_PHI],
  [INV_PHI, 0, PHI],
  [PHI, INV_PHI, 0],
  [0, PHI, -INV_PHI],
  [-INV_PHI, 0, PHI],
  [PHI, -INV_PHI, 0],
  [0, -PHI, INV_PHI],
  [INV_PHI, 0, -PHI],
  [-PHI, INV_PHI, 0],
  [0, -PHI, -INV_PHI],
  [-INV_PHI, 0, -PHI],
  [-PHI, -INV_PHI, 0],
];

const DODECA_FACES = [
  [0, 17, 14, 1, 19],
  [0, 19, 16, 2, 18],
  [0, 18, 15, 4, 17],
  [1, 12, 3, 16, 19],
  [1, 14, 5, 9, 12],
  [2, 16, 3, 8, 11],
  [2, 11, 6, 15, 18],
  [3, 12, 9, 7, 8],
  [4, 15, 6, 10, 13],
  [4, 13, 5, 14, 17],
  [5, 13, 10, 7, 9],
  [6, 11, 8, 7, 10],
];

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mul(scalar, point) {
  return [scalar * point[0], scalar * point[1], scalar * point[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length(point) {
  return Math.sqrt(dot(point, point));
}

function unit(point) {
  const pointLength = length(point);
  if (pointLength === 0) {
    throw new Error("Cannot normalize a zero-length vector");
  }
  return mul(1 / pointLength, point);
}

function average(points) {
  return mul(1 / points.length, [
    points.reduce((sum, point) => sum + point[0], 0),
    points.reduce((sum, point) => sum + point[1], 0),
    points.reduce((sum, point) => sum + point[2], 0),
  ]);
}

function pointToward(start, end, fraction) {
  return add(start, mul(fraction, sub(end, start)));
}

function vec3(point) {
  return new THREE.Vector3(point[0], point[1], point[2]);
}

function dodecaFaceCenter(face) {
  return average(face.map((index) => DODECA_VERTICES[index]));
}

function dodecaFaceNormal(face, center) {
  const [a, b, c] = face.slice(0, 3).map((index) => DODECA_VERTICES[index]);
  let normal = unit(cross(sub(b, a), sub(c, a)));
  if (dot(normal, center) < 0) {
    normal = mul(-1, normal);
  }
  return normal;
}

function dodecaFaceAdjacency() {
  const faceSets = DODECA_FACES.map((face) => new Set(face));
  const adjacency = new Map(DODECA_FACES.map((_face, index) => [index, new Set()]));
  for (let left = 0; left < DODECA_FACES.length; left += 1) {
    for (let right = left + 1; right < DODECA_FACES.length; right += 1) {
      let shared = 0;
      for (const vertex of faceSets[left]) {
        if (faceSets[right].has(vertex)) {
          shared += 1;
        }
      }
      if (shared === 2) {
        adjacency.get(left).add(right);
        adjacency.get(right).add(left);
      }
    }
  }
  return adjacency;
}

function indexedSmallStellatedFaces() {
  const centers = DODECA_FACES.map(dodecaFaceCenter);
  const normals = DODECA_FACES.map((face, index) => dodecaFaceNormal(face, centers[index]));
  const apexHeight = Math.sqrt(2 + 2 / Math.sqrt(5));
  const ssdVertices = centers.map((center, index) => add(center, mul(apexHeight, normals[index])));
  const adjacency = dodecaFaceAdjacency();

  return DODECA_FACES.map((face, faceIndex) => {
    const center = centers[faceIndex];
    const normal = normals[faceIndex];
    const firstVertex = DODECA_VERTICES[face[0]];
    const basisU = unit(sub(firstVertex, center));
    const basisV = cross(normal, basisU);
    const cyclic = [...adjacency.get(faceIndex)].sort((left, right) => {
      const leftVector = sub(ssdVertices[left], center);
      const rightVector = sub(ssdVertices[right], center);
      const leftAngle = Math.atan2(dot(leftVector, basisV), dot(leftVector, basisU));
      const rightAngle = Math.atan2(dot(rightVector, basisV), dot(rightVector, basisU));
      return leftAngle - rightAngle;
    });
    const vertexIndices = Array.from({ length: 5 }, (_item, index) => cyclic[(2 * index) % 5]);
    const vertices = vertexIndices.map((index) => ssdVertices[index]);
    return {
      index: faceIndex,
      center: average(vertices),
      normal,
      vertexIndices,
      vertices,
    };
  });
}

function skeletonPolyline(faceVertices, index) {
  const start = faceVertices[index];
  const bend = pointToward(start, faceVertices[(index + 1) % 5], FACE_STAR_RATIO);
  return [start, bend, average(faceVertices)];
}

function buildArms(faces) {
  const arms = [];
  for (const face of faces) {
    for (let localIndex = 0; localIndex < 5; localIndex += 1) {
      arms.push({
        face,
        localIndex,
        tipIndex: face.vertexIndices[localIndex],
        points: skeletonPolyline(face.vertices, localIndex),
      });
    }
  }
  return arms;
}

function sortByDirection(items, axis) {
  const first = sub(items[0].direction, mul(dot(items[0].direction, axis), axis));
  const basisU = unit(first);
  const basisV = cross(axis, basisU);
  return [...items].sort((left, right) => {
    const leftAngle = Math.atan2(dot(left.direction, basisV), dot(left.direction, basisU));
    const rightAngle = Math.atan2(dot(right.direction, basisV), dot(right.direction, basisU));
    return leftAngle - rightAngle;
  });
}

function offsetLineIntersection(originA, directionA, originB, directionB) {
  const between = sub(originB, originA);
  const aa = dot(directionA, directionA);
  const bb = dot(directionB, directionB);
  const ab = dot(directionA, directionB);
  const denominator = aa * bb - ab * ab;
  if (Math.abs(denominator) < 1e-10) {
    return average([originA, originB]);
  }
  const t = (dot(between, directionA) * bb - dot(between, directionB) * ab) / denominator;
  return add(originA, mul(t, directionA));
}

function rejectAlong(vectorToReject, axis) {
  return sub(vectorToReject, mul(dot(vectorToReject, axis), axis));
}

function faceInwardFromEdge(face, apex, edgeDirection) {
  return unit(rejectAlong(sub(face.center, apex), edgeDirection));
}

function edgeKey(first, second) {
  return first < second ? `${first}:${second}` : `${second}:${first}`;
}

function incidentEdgeFaceMap(faces) {
  const edgeFaces = new Map();
  for (const face of faces) {
    for (let index = 0; index < 5; index += 1) {
      const first = face.vertexIndices[index];
      const second = face.vertexIndices[(index + 1) % 5];
      const key = edgeKey(first, second);
      if (!edgeFaces.has(key)) {
        edgeFaces.set(key, []);
      }
      edgeFaces.get(key).push(face);
    }
  }
  return edgeFaces;
}

function otherFaceForEdge(edgeFaces, firstTip, secondTip, knownFace) {
  const owners = edgeFaces.get(edgeKey(firstTip, secondTip));
  if (!owners || owners.length !== 2) {
    throw new Error("SSD edge does not have two incident faces");
  }
  return owners[0].index === knownFace.index ? owners[1] : owners[0];
}

function miterPointInFace(face, tipIndex, width) {
  const localIndex = face.vertexIndices.indexOf(tipIndex);
  const apex = face.vertices[localIndex];
  const previousVertex = face.vertices[(localIndex + 4) % 5];
  const nextVertex = face.vertices[(localIndex + 1) % 5];

  const previousDirection = unit(sub(previousVertex, apex));
  const nextDirection = unit(sub(nextVertex, apex));
  const previousInward = faceInwardFromEdge(face, apex, previousDirection);
  const nextInward = faceInwardFromEdge(face, apex, nextDirection);

  return offsetLineIntersection(
    add(apex, mul(width, previousInward)),
    previousDirection,
    add(apex, mul(width, nextInward)),
    nextDirection,
  );
}

function tipArms(faces, arms, tipIndex) {
  const selected = arms.filter((arm) => arm.tipIndex === tipIndex);
  const apex = selected[0].points[0];
  return sortByDirection(
    selected.map((arm) => ({
      item: arm,
      direction: unit(sub(arm.points[1], arm.points[0])),
    })),
    unit(apex),
  ).map((entry) => entry.item);
}

function tipInnerApex(apex, width) {
  return add(apex, mul(2 * width, unit(mul(-1, apex))));
}

function armGeometry(arm, otherFace, faceMiters, innerApex, width) {
  const [apex, bend] = arm.points;
  const segment = sub(bend, apex);
  const edgeDirectionValue = unit(segment);
  const outerEnd = bend;
  return {
    arm,
    otherFace,
    outerEnd,
    innerApex,
    firstSide: {
      face: arm.face,
      start: faceMiters.get(arm.face.index),
      end: add(outerEnd, mul(width, faceInwardFromEdge(arm.face, apex, edgeDirectionValue))),
    },
    secondSide: {
      face: otherFace,
      start: faceMiters.get(otherFace.index),
      end: add(outerEnd, mul(width, faceInwardFromEdge(otherFace, apex, edgeDirectionValue))),
    },
  };
}

function adjustedInnerEnd(geometry) {
  return add(geometry.secondSide.end, sub(geometry.firstSide.end, geometry.outerEnd));
}

function edgeDirectionForGeometry(geometry) {
  return unit(sub(geometry.outerEnd, geometry.arm.points[0]));
}

function miterWidth(geometry) {
  return length(sub(geometry.firstSide.end, geometry.outerEnd));
}

function bendMiterExtension(geometry) {
  return BEND_MITER_EXTENSION_FACTOR * miterWidth(geometry);
}

function bendInnerExtension(geometry) {
  return BEND_INNER_EXTENSION_FACTOR * miterWidth(geometry);
}

function miteredOuterPoint(geometry) {
  return add(geometry.outerEnd, mul(bendMiterExtension(geometry), edgeDirectionForGeometry(geometry)));
}

function miteredFirstPoint(geometry) {
  return add(geometry.firstSide.end, mul(bendInnerExtension(geometry), edgeDirectionForGeometry(geometry)));
}

function miteredSecondPoint(geometry) {
  return add(geometry.secondSide.end, mul(bendInnerExtension(geometry), edgeDirectionForGeometry(geometry)));
}

function miteredParallelogramInnerPoint(geometry) {
  return add(
    adjustedInnerEnd(geometry),
    mul(2 * bendInnerExtension(geometry) - bendMiterExtension(geometry), edgeDirectionForGeometry(geometry)),
  );
}

function miteredSideEndInFace(geometry, face) {
  if (geometry.firstSide.face.index === face.index) {
    return miteredFirstPoint(geometry);
  }
  if (geometry.secondSide.face.index === face.index) {
    return miteredSecondPoint(geometry);
  }
  throw new Error("Geometry is not incident to face");
}

function miteredStarFacePatchPoints(face, tipIndex, geometries, faceMiters) {
  const localIndex = face.vertexIndices.indexOf(tipIndex);
  const apex = face.vertices[localIndex];
  const previousDirection = unit(sub(face.vertices[(localIndex + 4) % 5], apex));
  const nextDirection = unit(sub(face.vertices[(localIndex + 1) % 5], apex));
  let previousGeometry = null;
  let nextGeometry = null;

  for (const geometry of geometries) {
    if (geometry.firstSide.face.index !== face.index && geometry.secondSide.face.index !== face.index) {
      continue;
    }
    const direction = unit(sub(miteredOuterPoint(geometry), apex));
    if (dot(direction, previousDirection) > dot(direction, nextDirection)) {
      previousGeometry = geometry;
    } else {
      nextGeometry = geometry;
    }
  }

  return [
    apex,
    miteredOuterPoint(previousGeometry),
    miteredSideEndInFace(previousGeometry, face),
    faceMiters.get(face.index),
    miteredSideEndInFace(nextGeometry, face),
    miteredOuterPoint(nextGeometry),
  ];
}

function buildTipNodePolygonsFlattened(faces, arms, edgeFaces, tipIndex, width) {
  const selectedArms = tipArms(faces, arms, tipIndex);
  const incidentFaces = faces.filter((face) => face.vertexIndices.includes(tipIndex));
  const faceMiters = new Map(incidentFaces.map((face) => [face.index, miterPointInFace(face, tipIndex, width)]));
  const innerApex = tipInnerApex(selectedArms[0].points[0], width);

  const geometriesByKey = new Map();
  const orderedGeometries = [];
  for (const arm of selectedArms) {
    const nextTip = arm.face.vertexIndices[(arm.localIndex + 1) % 5];
    const otherFace = otherFaceForEdge(edgeFaces, tipIndex, nextTip, arm.face);
    const geometry = armGeometry(arm, otherFace, faceMiters, innerApex, width);
    geometriesByKey.set(`${arm.face.index}:${arm.localIndex}`, geometry);
    orderedGeometries.push(geometry);
  }

  const polygons = [];
  for (const face of incidentFaces) {
    polygons.push(miteredStarFacePatchPoints(face, tipIndex, orderedGeometries, faceMiters));
  }
  for (const geometry of orderedGeometries) {
    const innerEnd = miteredParallelogramInnerPoint(geometry);
    polygons.push([geometry.firstSide.start, miteredFirstPoint(geometry), innerEnd, geometry.innerApex]);
    polygons.push([geometry.secondSide.start, geometry.innerApex, innerEnd, miteredSecondPoint(geometry)]);
  }

  return { geometriesByKey, polygons };
}

function orderedMiteredFaceGeometries(face, geometries) {
  const entries = [];
  for (let localIndex = 0; localIndex < 5; localIndex += 1) {
    const geometry = geometries.get(`${face.index}:${localIndex}`);
    entries.push({
      item: geometry,
      direction: unit(sub(miteredOuterPoint(geometry), face.center)),
    });
  }
  return sortByDirection(entries, face.normal).map((entry) => entry.item);
}

function centerMiterPoints(originsBefore, originsAfter, tangents) {
  return originsBefore.map((beforeOrigin, index) => {
    const previousIndex = (index + originsBefore.length - 1) % originsBefore.length;
    return offsetLineIntersection(
      beforeOrigin,
      tangents[index],
      originsAfter[previousIndex],
      tangents[previousIndex],
    );
  });
}

function faceCenterlineTubePolygons(face, geometries) {
  const ordered = orderedMiteredFaceGeometries(face, geometries);
  const tangents = ordered.map((geometry) => unit(sub(face.center, geometry.outerEnd)));

  const leftPoints = ordered.map(miteredOuterPoint);
  const rightPoints = ordered.map(miteredFirstPoint);
  const lowerLeftPoints = ordered.map(miteredSecondPoint);
  const lowerRightPoints = ordered.map(miteredParallelogramInnerPoint);

  const topMiters = centerMiterPoints(rightPoints, leftPoints, tangents);
  const bottomMiters = centerMiterPoints(lowerRightPoints, lowerLeftPoints, tangents);

  const polygons = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const nextIndex = (index + 1) % ordered.length;
    polygons.push([leftPoints[index], rightPoints[index], topMiters[index], topMiters[nextIndex]]);
    polygons.push([lowerLeftPoints[index], bottomMiters[nextIndex], bottomMiters[index], lowerRightPoints[index]]);
    polygons.push([rightPoints[index], lowerRightPoints[index], bottomMiters[index], topMiters[index]]);
    polygons.push([leftPoints[index], topMiters[nextIndex], bottomMiters[nextIndex], lowerLeftPoints[index]]);
  }
  polygons.push(topMiters);
  polygons.push([...bottomMiters].reverse());
  return polygons;
}

function buildRawPolygonsCenterline(width) {
  const faces = indexedSmallStellatedFaces();
  const arms = buildArms(faces);
  const edgeFaces = incidentEdgeFaceMap(faces);
  const polygons = [];
  const geometries = new Map();
  const tipIndices = [...new Set(arms.map((arm) => arm.tipIndex))].sort((a, b) => a - b);

  for (const tipIndex of tipIndices) {
    const { geometriesByKey, polygons: tipPolygons } = buildTipNodePolygonsFlattened(
      faces,
      arms,
      edgeFaces,
      tipIndex,
      width,
    );
    for (const [key, value] of geometriesByKey.entries()) {
      geometries.set(key, value);
    }
    polygons.push(...tipPolygons);
  }

  for (const face of faces) {
    polygons.push(...faceCenterlineTubePolygons(face, geometries));
  }
  return polygons;
}

function makeLocalArmGeometry(arm, otherFace, faceMiters, innerApex, width, lengthFraction) {
  const [apex, bend] = arm.points;
  const segment = mul(lengthFraction, sub(bend, apex));
  const outerEnd = add(apex, segment);
  const edgeDirectionValue = unit(segment);
  const innerEnd = add(innerApex, segment);
  return {
    arm,
    otherFace,
    outerEnd,
    innerApex,
    innerEnd,
    firstSide: {
      face: arm.face,
      start: faceMiters.get(arm.face.index),
      end: add(outerEnd, mul(width, faceInwardFromEdge(arm.face, apex, edgeDirectionValue))),
    },
    secondSide: {
      face: otherFace,
      start: faceMiters.get(otherFace.index),
      end: add(outerEnd, mul(width, faceInwardFromEdge(otherFace, apex, edgeDirectionValue))),
    },
  };
}

function localStarFacePatch(face, tipIndex, geometries, faceMiters) {
  const localIndex = face.vertexIndices.indexOf(tipIndex);
  const apex = face.vertices[localIndex];
  const previousDirection = unit(sub(face.vertices[(localIndex + 4) % 5], apex));
  const nextDirection = unit(sub(face.vertices[(localIndex + 1) % 5], apex));
  let previousGeometry = null;
  let previousSide = null;
  let nextGeometry = null;
  let nextSide = null;

  for (const geometry of geometries) {
    let side = null;
    if (geometry.firstSide.face.index === face.index) {
      side = geometry.firstSide;
    } else if (geometry.secondSide.face.index === face.index) {
      side = geometry.secondSide;
    }
    if (!side) {
      continue;
    }
    const direction = unit(sub(geometry.outerEnd, apex));
    if (dot(direction, previousDirection) > dot(direction, nextDirection)) {
      previousGeometry = geometry;
      previousSide = side;
    } else {
      nextGeometry = geometry;
      nextSide = side;
    }
  }

  return [
    apex,
    previousGeometry.outerEnd,
    previousSide.end,
    faceMiters.get(face.index),
    nextSide.end,
    nextGeometry.outerEnd,
  ];
}

function buildTipLocalPrototypePolygons({ tipIndex = 4, width = 0.1, lengthFraction = 1.0 } = {}) {
  const faces = indexedSmallStellatedFaces();
  const arms = buildArms(faces);
  const edgeFaces = incidentEdgeFaceMap(faces);
  const selectedArms = tipArms(faces, arms, tipIndex);
  const incidentFaces = faces.filter((face) => face.vertexIndices.includes(tipIndex));
  const faceMiters = new Map(incidentFaces.map((face) => [face.index, miterPointInFace(face, tipIndex, width)]));
  const innerApex = tipInnerApex(selectedArms[0].points[0], width);
  const geometries = [];

  for (const arm of selectedArms) {
    const nextTip = arm.face.vertexIndices[(arm.localIndex + 1) % 5];
    const otherFace = otherFaceForEdge(edgeFaces, tipIndex, nextTip, arm.face);
    geometries.push(makeLocalArmGeometry(arm, otherFace, faceMiters, innerApex, width, lengthFraction));
  }

  const polygons = [];
  for (const face of incidentFaces) {
    polygons.push(localStarFacePatch(face, tipIndex, geometries, faceMiters));
  }
  for (const geometry of geometries) {
    polygons.push([geometry.firstSide.start, geometry.firstSide.end, geometry.innerEnd, geometry.innerApex]);
    polygons.push([geometry.secondSide.start, geometry.innerApex, geometry.innerEnd, geometry.secondSide.end]);
    polygons.push([geometry.outerEnd, geometry.secondSide.end, geometry.innerEnd, geometry.firstSide.end]);
  }
  return polygons;
}

function firstUsableNormal(points) {
  for (let index = 1; index < points.length - 1; index += 1) {
    const normal = cross(sub(points[index], points[0]), sub(points[index + 1], points[0]));
    if (length(normal) > 1e-8) {
      return unit(normal);
    }
  }
  return [0, 0, 1];
}

function polygonBasis(points) {
  const origin = points[0];
  const normal = firstUsableNormal(points);
  let basisU = null;
  for (let index = 1; index < points.length; index += 1) {
    const candidate = rejectAlong(sub(points[index], origin), normal);
    if (length(candidate) > 1e-8) {
      basisU = unit(candidate);
      break;
    }
  }
  if (!basisU) {
    basisU = [1, 0, 0];
  }
  const basisV = cross(normal, basisU);
  return { origin, normal, basisU, basisV };
}

function pushVertex(target, point) {
  target.push(point[0], point[1], point[2]);
}

function appendPolygonTriangles(positions, polygon) {
  const points = polygon.filter((point, index) => index === 0 || length(sub(point, polygon[index - 1])) > 1e-9);
  if (points.length < 3) {
    return;
  }
  const { origin, normal, basisU, basisV } = polygonBasis(points);
  const points2 = points.map((point) => {
    const relative = sub(point, origin);
    return new THREE.Vector2(dot(relative, basisU), dot(relative, basisV));
  });
  const triangles = THREE.ShapeUtils.triangulateShape(points2, []);
  for (const triangle of triangles) {
    const a = points[triangle[0]];
    const b = points[triangle[1]];
    const c = points[triangle[2]];
    const triNormal = cross(sub(b, a), sub(c, a));
    if (dot(triNormal, normal) < 0) {
      pushVertex(positions, a);
      pushVertex(positions, c);
      pushVertex(positions, b);
    } else {
      pushVertex(positions, a);
      pushVertex(positions, b);
      pushVertex(positions, c);
    }
  }
}

function makePolygonMesh(polygons, materialOptions = {}) {
  const positions = [];
  for (const polygon of polygons) {
    appendPolygonTriangles(positions, polygon);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: materialOptions.color ?? 0xb9b5aa,
      roughness: materialOptions.roughness ?? 0.62,
      metalness: materialOptions.metalness ?? 0.02,
      side: THREE.DoubleSide,
      transparent: materialOptions.transparent ?? false,
      opacity: materialOptions.opacity ?? 1,
    }),
  );
}

function makePolygonBoundaryLines(polygons, color = 0x252525, opacity = 0.35) {
  const positions = [];
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      pushVertex(positions, polygon[index]);
      pushVertex(positions, polygon[(index + 1) % polygon.length]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
    }),
  );
}

function smallStellatedDodecahedronSurfacePolygons() {
  const centers = DODECA_FACES.map(dodecaFaceCenter);
  const normals = DODECA_FACES.map((face, index) => dodecaFaceNormal(face, centers[index]));
  const apexHeight = Math.sqrt(2 + 2 / Math.sqrt(5));
  const apexes = centers.map((center, index) => add(center, mul(apexHeight, normals[index])));
  const polygons = [];

  for (let faceIndex = 0; faceIndex < DODECA_FACES.length; faceIndex += 1) {
    const face = DODECA_FACES[faceIndex];
    const apex = apexes[faceIndex];
    for (let index = 0; index < face.length; index += 1) {
      polygons.push([
        apex,
        DODECA_VERTICES[face[index]],
        DODECA_VERTICES[face[(index + 1) % face.length]],
      ]);
    }
  }
  return polygons;
}

function makeClosedPolyline(points, color, opacity = 1) {
  const positions = [];
  for (let index = 0; index < points.length; index += 1) {
    pushVertex(positions, points[index]);
    pushVertex(positions, points[(index + 1) % points.length]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
    }),
  );
}

function makeTubeForPolyline(points, radius, material) {
  const path = new THREE.CurvePath();
  for (let index = 0; index < points.length - 1; index += 1) {
    path.add(new THREE.LineCurve3(vec3(points[index]), vec3(points[index + 1])));
  }
  const geometry = new THREE.TubeGeometry(path, 16, radius, 8, false);
  return new THREE.Mesh(geometry, material);
}

export function createIntroModel({ scale = 10 } = {}) {
  const group = new THREE.Group();
  const dodecaPolygons = DODECA_FACES.map((face) => face.map((index) => DODECA_VERTICES[index]));
  const dodecaMesh = makePolygonMesh(dodecaPolygons, {
    color: 0xd4b54a,
    roughness: 0.8,
  });
  group.add(dodecaMesh);
  group.add(makePolygonBoundaryLines(dodecaPolygons, 0x6f5b1d, 0.4));

  const starFaces = indexedSmallStellatedFaces();
  for (const face of starFaces) {
    group.add(makeClosedPolyline(face.vertices, 0x222426, 0.86));
  }
  group.scale.setScalar(scale);
  return group;
}

export function createSolidSmallStellatedModel({ scale = 10 } = {}) {
  const group = new THREE.Group();
  const polygons = smallStellatedDodecahedronSurfacePolygons();
  group.add(makePolygonMesh(polygons, { color: 0xd1a526, roughness: 0.64 }));
  group.add(makePolygonBoundaryLines(polygons, 0x3f3413, 0.28));
  group.scale.setScalar(scale);
  return group;
}

export function createSkeletonModel({ scale = 10, radius = 0.025 } = {}) {
  const group = new THREE.Group();
  const faces = indexedSmallStellatedFaces();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd1a526, roughness: 0.55, metalness: 0.02 });
  for (const face of faces) {
    for (let index = 0; index < 5; index += 1) {
      group.add(makeTubeForPolyline(skeletonPolyline(face.vertices, index), radius, gold));
    }
  }
  group.scale.setScalar(scale);
  return group;
}

export function createTipPrototypeModel({ scale = 10, width = 0.1 } = {}) {
  const group = new THREE.Group();
  const polygons = buildTipLocalPrototypePolygons({ width, tipIndex: 4, lengthFraction: 1 });
  group.add(makePolygonMesh(polygons, { color: 0xd1a526, roughness: 0.68 }));
  group.add(makePolygonBoundaryLines(polygons, 0x3f3413, 0.38));
  group.scale.setScalar(scale);
  return group;
}

export function createFinalModel({ scale = 10, width = 0.2 } = {}) {
  const group = new THREE.Group();
  const polygons = buildRawPolygonsCenterline(width);
  group.add(makePolygonMesh(polygons, { color: 0xd1a526, roughness: 0.66 }));
  group.add(makePolygonBoundaryLines(polygons, 0x3f3413, 0.2));
  group.scale.setScalar(scale);
  return group;
}

export function estimateMinPrintableThickness(width, scale = 10) {
  return width * scale * 0.8944271909999159;
}
