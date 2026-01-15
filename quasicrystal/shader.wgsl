struct Uniforms {
    resolution : vec2<f32>,
    offset : vec2<f32>,
    time : f32,
    zoom : f32,
    angle : f32,
    color_hue : f32,
    points : f32,
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0)
    );
    var output : VertexOutput;
    output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    return output;
}

fn hsv2rgb(c : vec3<f32>) -> vec3<f32> {
    let K = vec4<f32>(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3<f32>(0.0), vec3<f32>(1.0)), c.y);
}

@fragment
fn fs_main(@builtin(position) fragCoord : vec4<f32>) -> @location(0) vec4<f32> {
    let PI : f32 = 3.14159265359;

    var uv_center = (fragCoord.xy - uniforms.resolution * 0.5);

    // Apply Rotation
    let c = cos(uniforms.angle);
    let s = sin(uniforms.angle);
    uv_center = vec2<f32>(
        uv_center.x * c - uv_center.y * s,
        uv_center.x * s + uv_center.y * c
    );

    let uv = uv_center * uniforms.zoom + uniforms.offset;

    var value : f32 = 0.0;
    let t : f32 = 1.5 * uniforms.time;

    let points_f = uniforms.points;
    let points_i = i32(points_f);

    for (var i : i32 = 0; i < points_i; i++) {
        let angle = PI / points_f * f32(i);
        let w = uv.x * sin(angle) + uv.y * cos(angle);
        value += sin(w + t);
    }

    let raw_wave = (cos(value * PI) + 1.0) * 0.5;
    let intensity = pow(raw_wave, 2.5);
    let base_hue_color = hsv2rgb(vec3<f32>(uniforms.color_hue, 1.0, 1.0));
    let core_color = mix(base_hue_color, vec3<f32>(1.0, 1.0, 1.0), intensity * 0.35);
    let final_color = core_color * intensity * 2.0;

    return vec4<f32>(final_color, 1.0);
}
