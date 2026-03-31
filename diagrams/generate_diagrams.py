"""
PatentForge v0.3.1 — Architecture Diagram Generator
Generates 5 PNG diagrams reflecting the current system state.
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Color palette (matching landing page dark theme) ──
BG = '#0f172a'
SURFACE = '#1e293b'
BORDER = '#334155'
TEXT = '#e2e8f0'
MUTED = '#94a3b8'
ACCENT = '#3b82f6'
GREEN = '#22c55e'
AMBER = '#f59e0b'
PURPLE = '#a78bfa'
RED = '#ef4444'
PINK = '#f472b6'

def make_box(ax, x, y, w, h, title, subtitle='', color=ACCENT, title_size=11):
    """Draw a rounded box with title and optional subtitle."""
    box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02",
                         facecolor=SURFACE, edgecolor=color, linewidth=2)
    ax.add_patch(box)
    cy = y + h/2
    if subtitle:
        ax.text(x + w/2, cy + 0.02, title, ha='center', va='center',
                color=TEXT, fontsize=title_size, fontweight='bold', fontfamily='sans-serif')
        ax.text(x + w/2, cy - 0.04, subtitle, ha='center', va='center',
                color=MUTED, fontsize=8, fontfamily='sans-serif')
    else:
        ax.text(x + w/2, cy, title, ha='center', va='center',
                color=TEXT, fontsize=title_size, fontweight='bold', fontfamily='sans-serif')

def arrow(ax, x1, y1, x2, y2, color=MUTED, style='->', lw=1.5, label='', label_offset=(0, 0.02)):
    """Draw an arrow with optional label."""
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=lw))
    if label:
        mx, my = (x1+x2)/2 + label_offset[0], (y1+y2)/2 + label_offset[1]
        ax.text(mx, my, label, ha='center', va='center', color=color,
                fontsize=7.5, fontfamily='sans-serif')


# ══════════════════════════════════════════════════════════
# 1. ARCHITECTURE DIAGRAM
# ══════════════════════════════════════════════════════════
def gen_architecture():
    fig, ax = plt.subplots(1, 1, figsize=(10, 6))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis('off')

    # Title
    ax.text(0.5, 0.95, 'PatentForge — System Architecture (v0.3.1)',
            ha='center', va='center', color=TEXT, fontsize=16, fontweight='bold')

    # Frontend
    make_box(ax, 0.02, 0.65, 0.25, 0.18, 'React Frontend', 'TypeScript + Vite + Tailwind\nport 8080', ACCENT)
    # Backend
    make_box(ax, 0.37, 0.65, 0.25, 0.18, 'NestJS Backend', 'Prisma ORM + REST API\nport 3000', ACCENT)
    # Feasibility
    make_box(ax, 0.72, 0.65, 0.26, 0.18, 'Feasibility Service', 'Express + 6 Prompts\nport 3001', GREEN)

    # Arrows between services
    arrow(ax, 0.27, 0.77, 0.37, 0.77, MUTED, label='HTTP', label_offset=(0, 0.02))
    arrow(ax, 0.37, 0.71, 0.27, 0.71, ACCENT, label='SSE', label_offset=(0, -0.03))
    arrow(ax, 0.62, 0.77, 0.72, 0.77, MUTED, label='HTTP', label_offset=(0, 0.02))
    arrow(ax, 0.72, 0.71, 0.62, 0.71, GREEN, label='SSE', label_offset=(0, -0.03))

    # Database
    db_x, db_y = 0.37, 0.35
    ellipse1 = mpatches.Ellipse((db_x + 0.125, db_y + 0.1), 0.2, 0.08,
                                 facecolor=SURFACE, edgecolor=AMBER, linewidth=1.5)
    ax.add_patch(ellipse1)
    rect = mpatches.Rectangle((db_x + 0.025, db_y + 0.02), 0.2, 0.08,
                               facecolor=SURFACE, edgecolor=AMBER, linewidth=1.5)
    ax.add_patch(rect)
    ellipse2 = mpatches.Ellipse((db_x + 0.125, db_y + 0.02), 0.2, 0.08,
                                 facecolor=SURFACE, edgecolor=AMBER, linewidth=1.5)
    ax.add_patch(ellipse2)
    ax.text(db_x + 0.125, db_y + 0.06, 'SQLite / PostgreSQL', ha='center', va='center',
            color=AMBER, fontsize=9, fontweight='bold')
    # Arrow backend → db
    arrow(ax, 0.495, 0.65, 0.495, 0.46, AMBER, label='Prisma', label_offset=(0.04, 0))

    # External APIs
    # Anthropic
    make_box(ax, 0.72, 0.35, 0.2, 0.12, 'Anthropic', 'Claude API (SSE)', PURPLE, title_size=10)
    arrow(ax, 0.85, 0.65, 0.85, 0.47, PURPLE, label='SSE stream', label_offset=(0.06, 0))

    # PatentsView
    make_box(ax, 0.72, 0.15, 0.2, 0.12, 'PatentsView', 'USPTO Patent Data', PURPLE, title_size=10)
    arrow(ax, 0.55, 0.65, 0.77, 0.27, PURPLE, style='->', lw=1, label='REST', label_offset=(-0.02, 0.02))

    # LiteLLM
    make_box(ax, 0.02, 0.35, 0.2, 0.12, 'LiteLLM', 'Model Pricing Data', PURPLE, title_size=10)
    arrow(ax, 0.14, 0.47, 0.14, 0.65, PURPLE, style='->', lw=1, label='cost est.', label_offset=(-0.05, 0))

    # Legend
    ax.text(0.02, 0.08, 'Legend:', color=TEXT, fontsize=8, fontweight='bold')
    ax.plot([0.09, 0.13], [0.08, 0.08], color=ACCENT, lw=2); ax.text(0.14, 0.08, 'SSE stream', color=MUTED, fontsize=7.5)
    ax.plot([0.09, 0.13], [0.04, 0.04], color=MUTED, lw=2); ax.text(0.14, 0.04, 'HTTP request', color=MUTED, fontsize=7.5)
    ax.plot([0.28, 0.32], [0.08, 0.08], color=PURPLE, lw=2); ax.text(0.33, 0.08, 'External API', color=MUTED, fontsize=7.5)
    ax.plot([0.28, 0.32], [0.04, 0.04], color=AMBER, lw=2); ax.text(0.33, 0.04, 'Database', color=MUTED, fontsize=7.5)

    fig.savefig(os.path.join(OUTPUT_DIR, 'architecture.png'), dpi=200, bbox_inches='tight',
                facecolor=BG, edgecolor='none')
    plt.close(fig)
    print('OK: architecture.png')


# ══════════════════════════════════════════════════════════
# 2. DATA FLOW DIAGRAM
# ══════════════════════════════════════════════════════════
def gen_data_flow():
    fig, ax = plt.subplots(1, 1, figsize=(12, 7))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1.2); ax.set_ylim(0, 1)
    ax.axis('off')

    ax.text(0.6, 0.95, 'PatentForge — 6-Stage Pipeline Data Flow',
            ha='center', va='center', color=TEXT, fontsize=16, fontweight='bold')

    # Inventor input
    make_box(ax, 0.02, 0.75, 0.2, 0.12, 'Invention Input', '11-field disclosure form', ACCENT, 10)

    # Stage boxes (vertical cascade)
    stages = [
        ('Stage 1', 'Technical Intake\n& Restatement', ACCENT),
        ('Stage 2', 'Prior Art\nResearch', GREEN),
        ('Stage 3', 'Patentability\nAssessment', ACCENT),
        ('Stage 4', 'Deep Dive\nAnalysis', ACCENT),
        ('Stage 5', 'IP Landscape\nAssessment', ACCENT),
        ('Stage 6', 'Consolidated\nReport', GREEN),
    ]

    y_start = 0.75
    x_stages = 0.32
    for i, (label, desc, color) in enumerate(stages):
        y = y_start - i * 0.13
        make_box(ax, x_stages, y, 0.22, 0.1, label, desc, color, 10)
        if i > 0:
            arrow(ax, x_stages + 0.11, y + 0.1 + 0.03, x_stages + 0.11, y + 0.1, MUTED)

    # Arrow from input to stage 1
    arrow(ax, 0.22, 0.81, 0.32, 0.81, MUTED, label='narrative', label_offset=(0, 0.02))

    # Side annotations
    # Stage 2 → web search
    make_box(ax, 0.65, 0.62, 0.2, 0.1, 'Anthropic', 'Web Search Tool', PURPLE, 9)
    arrow(ax, 0.54, 0.67, 0.65, 0.67, PURPLE, label='search', label_offset=(0, 0.02))

    # PatentsView feeding into Stage 2 area
    make_box(ax, 0.65, 0.48, 0.2, 0.1, 'PatentsView', 'USPTO patents', PURPLE, 9)
    arrow(ax, 0.54, 0.57, 0.65, 0.53, PURPLE, style='->', lw=1, label='prior art', label_offset=(0, 0.02))

    # Stages 3, 4 → web search
    make_box(ax, 0.92, 0.55, 0.2, 0.1, 'Anthropic', 'Verify citations', PURPLE, 9)
    arrow(ax, 0.54, 0.49, 0.92, 0.58, PURPLE, style='->', lw=1)

    # Each stage output accumulates
    ax.text(0.28, 0.5, 'Each stage receives\nall prior stage outputs', ha='center', va='center',
            color=MUTED, fontsize=8, fontstyle='italic',
            bbox=dict(boxstyle='round,pad=0.3', facecolor=BG, edgecolor=BORDER, linewidth=0.5))

    # Output
    make_box(ax, 0.65, 0.1, 0.22, 0.12, 'Export', 'HTML / Word / Markdown', AMBER, 10)
    arrow(ax, 0.54, 0.07 + 0.06, 0.65, 0.16, MUTED, label='report', label_offset=(0, 0.02))

    # SSE streaming annotation
    ax.text(0.95, 0.16, 'Real-time SSE\ntoken streaming\nto browser', ha='center', va='center',
            color=GREEN, fontsize=8, fontstyle='italic',
            bbox=dict(boxstyle='round,pad=0.3', facecolor=BG, edgecolor=GREEN, linewidth=0.5))
    arrow(ax, 0.87, 0.16, 0.92, 0.16, GREEN, style='->', lw=1)

    # Disclaimer watermark
    ax.text(0.65, 0.03, 'Every export includes hardcoded legal disclaimer',
            ha='left', va='center', color=MUTED, fontsize=7, fontstyle='italic')

    fig.savefig(os.path.join(OUTPUT_DIR, 'data-flow.png'), dpi=200, bbox_inches='tight',
                facecolor=BG, edgecolor='none')
    plt.close(fig)
    print('OK: data-flow.png')


# ══════════════════════════════════════════════════════════
# 3. USER JOURNEY
# ══════════════════════════════════════════════════════════
def gen_user_journey():
    fig, ax = plt.subplots(1, 1, figsize=(14, 4))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1.4); ax.set_ylim(0, 0.45)
    ax.axis('off')

    ax.text(0.7, 0.42, 'PatentForge — User Journey',
            ha='center', va='center', color=TEXT, fontsize=16, fontweight='bold')

    steps = [
        ('Describe\nInvention', '11-field form', ACCENT),
        ('Review\nCost Estimate', 'token + search', AMBER),
        ('Run\nAnalysis', '6-stage pipeline', GREEN),
        ('Watch\nStreaming', 'real-time SSE', GREEN),
        ('Review\nReport', 'on-screen viewer', ACCENT),
        ('Export', 'HTML / Word / MD', AMBER),
        ('Meet Your\nAttorney', 'prepared research', PURPLE),
    ]

    spacing = 0.185
    x_start = 0.03
    for i, (title, sub, color) in enumerate(steps):
        x = x_start + i * spacing
        # Number circle
        circle = mpatches.Circle((x + 0.06, 0.3), 0.018, facecolor=color, edgecolor='none')
        ax.add_patch(circle)
        ax.text(x + 0.06, 0.3, str(i + 1), ha='center', va='center',
                color='white', fontsize=9, fontweight='bold')
        # Box
        make_box(ax, x, 0.07, 0.13, 0.16, title, sub, color, 9)
        # Arrow
        if i < len(steps) - 1:
            arrow(ax, x + 0.13, 0.15, x + spacing, 0.15, MUTED)

    fig.savefig(os.path.join(OUTPUT_DIR, 'user-journey.png'), dpi=200, bbox_inches='tight',
                facecolor=BG, edgecolor='none')
    plt.close(fig)
    print('OK: user-journey.png')


# ══════════════════════════════════════════════════════════
# 4. DATABASE SCHEMA
# ══════════════════════════════════════════════════════════
def gen_database_schema():
    fig, ax = plt.subplots(1, 1, figsize=(12, 7))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1.2); ax.set_ylim(0, 1)
    ax.axis('off')

    ax.text(0.6, 0.96, 'PatentForge — Database Schema (v0.3.1)',
            ha='center', va='center', color=TEXT, fontsize=16, fontweight='bold')

    def entity_box(x, y, w, h, name, fields, color=ACCENT):
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.01",
                             facecolor=SURFACE, edgecolor=color, linewidth=2)
        ax.add_patch(box)
        # Header bar
        header = FancyBboxPatch((x, y + h - 0.06), w, 0.06, boxstyle="round,pad=0.01",
                                facecolor=color, edgecolor=color, linewidth=0)
        ax.add_patch(header)
        ax.text(x + w/2, y + h - 0.03, name, ha='center', va='center',
                color='white', fontsize=10, fontweight='bold')
        for i, field in enumerate(fields):
            ax.text(x + 0.01, y + h - 0.1 - i * 0.035, field,
                    color=MUTED, fontsize=7, fontfamily='monospace')

    # Project
    entity_box(0.02, 0.6, 0.22, 0.28, 'Project', [
        'id: UUID (PK)', 'title: String', 'status: ProjectStatus',
        'createdAt: DateTime', 'updatedAt: DateTime'
    ], ACCENT)

    # InventionInput
    entity_box(0.32, 0.6, 0.25, 0.28, 'InventionInput', [
        'id: UUID (PK)', 'projectId: UUID (FK, unique)',
        'title, description: String', '+ 9 optional text fields'
    ], GREEN)

    # FeasibilityRun
    entity_box(0.02, 0.2, 0.25, 0.3, 'FeasibilityRun', [
        'id: UUID (PK)', 'projectId: UUID (FK)',
        'version: Int', 'status: RunStatus',
        'startedAt, completedAt', 'finalReport: Text?'
    ], ACCENT)

    # FeasibilityStage
    entity_box(0.35, 0.2, 0.27, 0.3, 'FeasibilityStage', [
        'id: UUID (PK)', 'feasibilityRunId: UUID (FK)',
        'stageNumber: Int (1-6)', 'stageName: String',
        'status: RunStatus', 'outputText: Text?',
        'model: String?', 'webSearchUsed: Bool'
    ], GREEN)

    # PriorArtSearch
    entity_box(0.7, 0.6, 0.22, 0.28, 'PriorArtSearch', [
        'id: UUID (PK)', 'projectId: UUID (FK)',
        'version: Int', 'query: String[]'
    ], AMBER)

    # PriorArtResult
    entity_box(0.7, 0.2, 0.25, 0.3, 'PriorArtResult', [
        'id: UUID (PK)', 'searchId: UUID (FK)',
        'patentNumber: String', 'title: String',
        'relevanceScore: Float', 'abstract: Text?'
    ], AMBER)

    # AppSettings
    entity_box(1.0, 0.6, 0.18, 0.28, 'AppSettings', [
        'id: "singleton"', 'anthropicApiKey', 'defaultModel',
        'researchModel', 'maxTokens: Int', 'interStageDelay: Int'
    ], PURPLE)

    # Relationships
    arrow(ax, 0.24, 0.74, 0.32, 0.74, MUTED, label='1:1', label_offset=(0, 0.02))
    arrow(ax, 0.13, 0.6, 0.13, 0.5, MUTED, label='1:N', label_offset=(0.03, 0))
    arrow(ax, 0.27, 0.35, 0.35, 0.35, MUTED, label='1:N', label_offset=(0, 0.02))
    arrow(ax, 0.24, 0.74, 0.7, 0.74, MUTED, style='->', lw=1, label='1:N', label_offset=(0, 0.02))
    arrow(ax, 0.81, 0.6, 0.81, 0.5, MUTED, label='1:N', label_offset=(0.03, 0))

    fig.savefig(os.path.join(OUTPUT_DIR, 'database-schema.png'), dpi=200, bbox_inches='tight',
                facecolor=BG, edgecolor='none')
    plt.close(fig)
    print('OK: database-schema.png')


# ══════════════════════════════════════════════════════════
# 5. DOCKER TOPOLOGY
# ══════════════════════════════════════════════════════════
def gen_docker_topology():
    fig, ax = plt.subplots(1, 1, figsize=(10, 6))
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(BG)
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.axis('off')

    ax.text(0.5, 0.95, 'PatentForge — Docker Deployment Topology',
            ha='center', va='center', color=TEXT, fontsize=16, fontweight='bold')

    # Docker Compose Network boundary
    network = FancyBboxPatch((0.03, 0.08), 0.94, 0.78, boxstyle="round,pad=0.02",
                              facecolor='none', edgecolor=ACCENT, linewidth=1.5, linestyle='dashed')
    ax.add_patch(network)
    ax.text(0.5, 0.83, 'Docker Compose Network', ha='center', va='center',
            color=ACCENT, fontsize=10, fontstyle='italic')

    # Browser
    ax.text(0.15, 0.9, 'Browser', ha='center', va='center', color=MUTED, fontsize=9,
            bbox=dict(boxstyle='round,pad=0.3', facecolor=BG, edgecolor=BORDER))
    arrow(ax, 0.15, 0.88, 0.15, 0.78, MUTED, label=':8080')

    # Frontend container
    make_box(ax, 0.05, 0.62, 0.2, 0.14, 'frontend', 'React + Vite\n:8080', ACCENT, 10)

    # Backend container
    make_box(ax, 0.35, 0.62, 0.2, 0.14, 'backend', 'NestJS + Prisma\n:3000', ACCENT, 10)

    # Feasibility container
    make_box(ax, 0.65, 0.62, 0.24, 0.14, 'feasibility', 'Express + Pipeline\n:3001', GREEN, 10)

    # PostgreSQL container
    make_box(ax, 0.35, 0.3, 0.2, 0.14, 'postgres', 'PostgreSQL 16\n:5432', AMBER, 10)

    # Volumes
    ax.text(0.35 + 0.1, 0.18, 'pgdata volume', ha='center', va='center', color=AMBER, fontsize=8,
            bbox=dict(boxstyle='round,pad=0.3', facecolor=BG, edgecolor=AMBER, linewidth=0.5, linestyle='dashed'))
    arrow(ax, 0.45, 0.3, 0.45, 0.22, AMBER, style='->', lw=1)

    # Arrows
    arrow(ax, 0.25, 0.69, 0.35, 0.69, MUTED, label='HTTP/SSE')
    arrow(ax, 0.55, 0.69, 0.65, 0.69, MUTED, label='HTTP/SSE')
    arrow(ax, 0.45, 0.62, 0.45, 0.44, AMBER, label='TCP')

    # External APIs
    ax.text(0.82, 0.45, 'Anthropic API', ha='center', va='center', color=PURPLE, fontsize=9,
            bbox=dict(boxstyle='round,pad=0.3', facecolor=BG, edgecolor=PURPLE))
    arrow(ax, 0.82, 0.62, 0.82, 0.49, PURPLE, label='HTTPS')

    ax.text(0.82, 0.28, 'PatentsView API', ha='center', va='center', color=PURPLE, fontsize=9,
            bbox=dict(boxstyle='round,pad=0.3', facecolor=BG, edgecolor=PURPLE))
    arrow(ax, 0.5, 0.62, 0.75, 0.3, PURPLE, style='->', lw=1)

    # Note
    ax.text(0.05, 0.12, 'v0.3.1: frontend + backend + feasibility + postgres',
            color=MUTED, fontsize=8, fontstyle='italic')

    fig.savefig(os.path.join(OUTPUT_DIR, 'docker-topology.png'), dpi=200, bbox_inches='tight',
                facecolor=BG, edgecolor='none')
    plt.close(fig)
    print('OK: docker-topology.png')


if __name__ == '__main__':
    print('Generating PatentForge v0.3.1 diagrams...')
    gen_architecture()
    gen_data_flow()
    gen_user_journey()
    gen_database_schema()
    gen_docker_topology()
    print('Done — all 5 diagrams generated.')
