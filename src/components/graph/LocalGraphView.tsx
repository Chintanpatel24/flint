import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import * as d3 from 'd3';

export function LocalGraphView({ noteId }: { noteId: string }) {
  const { state, getBacklinks, getOutgoingLinks } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;

    const backlinks = getBacklinks(noteId);
    const outgoing = getOutgoingLinks(noteId);

    const nodes = [
      { id: note.id, title: note.title, group: 'active' },
      ...backlinks.map(n => ({ id: n.id, title: n.title, group: 'backlink' })),
      ...outgoing.map(n => ({ id: n.id, title: n.title, group: 'outgoing' })),
    ];

    const links = [
      ...backlinks.map(n => ({ source: n.id, target: note.id })),
      ...outgoing.map(n => ({ source: note.id, target: n.id })),
    ];

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#222')
      .attr('stroke-width', 1);

    const node = svg.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d: any) => d.group === 'active' ? 5 : 3)
      .attr('fill', (d: any) => d.group === 'active' ? '#4a9eff' : '#444')
      .style('filter', (d: any) => d.group === 'active' ? 'drop-shadow(0 0 4px #4a9eff)' : 'none');

    simulation.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
    });

  }, [noteId, state.notes]);

  return <svg ref={svgRef} style={{ width: '100%', height: '100%', background: '#000' }} />;
}
