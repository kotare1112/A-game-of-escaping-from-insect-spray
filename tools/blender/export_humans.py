"""人間モデルを色違いで 5 体分書き出すスクリプト。

assets/models/human.blend を開いた Blender で実行する
（Blender の「スクリプト」タブで開いて実行、または Claude Code から Blender MCP 経由で実行）。
public/models/human_1.glb 〜 human_5.glb を書き出し、最後に Blender 上の色を 1 人目に戻す。
あわせて 2〜5 人目を 1 人目の横に並べて表示する（Preview_Lineup コレクション。書き出しには含まれない）。
"""
import os

import bpy

# 色は 0〜1 の RGB（リニア）。キーはマテリアル名
PALETTE = [
    {  # 1: グレーの T シャツ・ジーンズ・白スニーカー
        "Human_Shirt": (0.75, 0.75, 0.78),
        "Human_Pants": (0.08, 0.12, 0.25),
        "Human_Shoes": (0.90, 0.90, 0.90),
        "Human_Hair": (0.05, 0.035, 0.025),
    },
    {  # 2: 赤の T シャツ・黒パンツ・黒スニーカー
        "Human_Shirt": (0.60, 0.06, 0.06),
        "Human_Pants": (0.03, 0.03, 0.035),
        "Human_Shoes": (0.04, 0.04, 0.04),
        "Human_Hair": (0.015, 0.012, 0.01),
    },
    {  # 3: 緑の T シャツ・ベージュのチノ・茶色の靴
        "Human_Shirt": (0.10, 0.30, 0.12),
        "Human_Pants": (0.55, 0.45, 0.30),
        "Human_Shoes": (0.20, 0.10, 0.05),
        "Human_Hair": (0.15, 0.08, 0.03),
    },
    {  # 4: 紺の T シャツ・グレーのパンツ・白スニーカー
        "Human_Shirt": (0.03, 0.05, 0.18),
        "Human_Pants": (0.30, 0.30, 0.32),
        "Human_Shoes": (0.90, 0.90, 0.90),
        "Human_Hair": (0.35, 0.22, 0.10),
    },
    {  # 5: 黄色の T シャツ・黒デニム・水色スニーカー
        "Human_Shirt": (0.85, 0.60, 0.05),
        "Human_Pants": (0.06, 0.06, 0.08),
        "Human_Shoes": (0.25, 0.55, 0.80),
        "Human_Hair": (0.08, 0.05, 0.03),
    },
]

# human.blend（assets/models/）から見た public/models/
OUT_DIR = os.path.normpath(os.path.join(os.path.dirname(bpy.data.filepath), "..", "..", "public", "models"))


def set_colors(colors):
    for name, rgb in colors.items():
        m = bpy.data.materials[name]
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        m.diffuse_color = (*rgb, 1.0)


def export_all():
    root = bpy.data.objects["Human"]
    objs = [root, *root.children_recursive]
    for i, colors in enumerate(PALETTE, start=1):
        set_colors(colors)
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT_DIR, f"human_{i}.glb"),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_yup=True,
        )
    bpy.ops.object.select_all(action="DESELECT")
    set_colors(PALETTE[0])


PREVIEW_COLLECTION = "Preview_Lineup"
PREVIEW_SPACING = 0.8  # 人と人の間隔（m）


def build_preview():
    """2〜5 人目を Blender 上で横に並べて見られるようにする（書き出しには含まれない）。

    形（メッシュ）は元の人間と共有しているので、元を直すと並んだ全員に反映される。
    色だけオブジェクトごとのマテリアルで変えている。
    """
    scene = bpy.context.scene
    old = bpy.data.collections.get(PREVIEW_COLLECTION)
    if old:
        for o in list(old.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)
    for m in [m for m in bpy.data.materials if m.name.startswith("Preview_")]:
        bpy.data.materials.remove(m)

    col = bpy.data.collections.new(PREVIEW_COLLECTION)
    scene.collection.children.link(col)
    src_root = bpy.data.objects["Human"]
    sources = [src_root, *src_root.children_recursive]

    for i, colors in enumerate(PALETTE[1:], start=2):
        mats = {}
        for name, rgb in colors.items():
            m = bpy.data.materials[name].copy()
            m.name = f"Preview_{name}_{i}"
            bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
            m.diffuse_color = (*rgb, 1.0)
            mats[name] = m

        copies = {}
        for o in sources:
            c = o.copy()  # データ（メッシュ）は共有
            c.name = f"Preview{i}_{o.name}"
            col.objects.link(c)
            copies[o] = c
        for o, c in copies.items():
            if o.parent in copies:
                c.parent = copies[o.parent]
                c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
            if o.type == "MESH":
                for slot in c.material_slots:
                    base = slot.material
                    slot.link = "OBJECT"
                    slot.material = mats.get(base.name, base) if base else None
        copies[src_root].location.x = src_root.location.x + PREVIEW_SPACING * (i - 1)


if __name__ == "__main__":
    export_all()
    build_preview()
