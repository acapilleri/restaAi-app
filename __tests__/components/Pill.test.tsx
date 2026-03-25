/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Pill } from '../../src/components/Pill';

describe('Pill', () => {
  it('renders children text', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<Pill>Colazione</Pill>);
    });
    expect(tree!.root.findByType(require('react-native').Text).props.children).toBe('Colazione');
  });

  it('defaults to inactive style', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<Pill>Test</Pill>);
    });
    expect(tree!).toMatchSnapshot();
  });

  it('applies active style when active=true', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<Pill active>Attivo</Pill>);
    });
    expect(tree!).toMatchSnapshot();
  });

  it('applies inactive when active=false', () => {
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<Pill active={false}>Inattivo</Pill>);
    });
    expect(tree!).toMatchSnapshot();
  });
});
