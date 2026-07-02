import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { FlintLogo } from '../FlintLogo';
import * as d3 from 'd3';

export function GraphView() {
  const { state, dispatch } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes = state.notes.map(n => ({ id: n.id, title: n.title }));
    const links: any[] = [];
    state.notes.forEach(note => {
      state.notes.forEach(other => {
        if (note.id !== other.id && note.content.includes(`[[${other.title}]]`)) {
          links.push({ source: note.id, target: other.id });
        }
      });
    });

    const width = window.innerWidth;
    const height = window.innerHeight;

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 1.5);

    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, any>()
        .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
      .attr('r', 6)
      .attr('fill', '#222')
      .attr('stroke', '#4a9eff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 0 6px rgba(74,158,255,0.4))');

    node.append('text')
      .text(d => d.title)
      .attr('x', 10)
      .attr('y', 4)
      .attr('fill', '#444')
      .style('font-size', '10px')
      .style('font-family', 'Inter, sans-serif')
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

  }, [state.notes]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505]">
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <FlintLogo size={24} />
        <span className="text-xs font-bold tracking-widest text-[#222] uppercase">Knowledge Graph</span>
      </div>
      <button onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
        className="absolute top-6 right-6 text-[#222] hover:text-white transition-colors">Close</button>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
