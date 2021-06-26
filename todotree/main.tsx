import { Button, Divider, message, Popconfirm, Progress, Select, Space, Tree, Typography } from 'antd'
import { CheckOutlined, DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'

import React, { useEffect, useMemo, useRef, useState } from 'react'

export type ITodoItem = {
  id: number
  content: string
  done: boolean
  level: 'secondary' | 'default' | 'success' | 'warning' | 'danger'
  pendingDelete?: boolean
}

export type ITodoTree = {
  key: string | number,
  children: ITodoTree[],
  todo: ITodoItem
}

export type Key = string | number

export type IStoreTodoTree = {
  tree: ITodoTree[]
  expandKeys: Key[]
}

export const calcProgressV2 = (todos: ITodoTree[]) => {
  let sum = 0
  let doneNum = 0
  const stack: ITodoTree[] = [...todos]
  while (stack.length) {
    const current = stack.pop()
    if (current.children) {
      stack.push(...current.children)
    }
    sum++
    if (current.todo.done) {
      doneNum++
    }
  }
  if (sum === 0) {
    return 0
  }
  return Number(Number((doneNum * 100) / sum).toFixed(0))
}


export const KEY_TODO_TREE = 'todotree'

export interface ITextMap {
  [key: string]: string
}

const template = (tpl: string, values: { [x: string]: any }) =>
  tpl.replace(/{\w+}/g, (slot: string) => values[slot.replace(/{|}/g, '')])

export class I18n {
  localesTextMap: { [locale: string]: ITextMap } = {}
  currentTextMap: ITextMap = {}
  registry(locale: string, text: ITextMap) {
    this.localesTextMap[locale] = text
  }

  setLocal(locale: string) {
    this.currentTextMap =
      this.localesTextMap[locale] ||
      this.localesTextMap[Object.keys(this.localesTextMap)[0]]
  }

  format(contentKey: string, args?: Record<string, string>) {
    const i18nformatString = this.currentTextMap[contentKey]
    if (!i18nformatString) {
      return ''
    }

    return args ? template(i18nformatString, args) : i18nformatString
  }
}

export const localeMap = {
  en: {
    removeItemTip: 'Are you sure to delete this backlog?',
    confirm: 'Ok',
    cancel: 'Cancel',
    newItem: 'New',
    save: 'Save',
    saveTip: 'Save success',
    clearDone: 'Clear completed',
    clearDoneTip: 'Are you sure to clear completed items?',
    update: 'Update List',
    updateTip: 'The update is successful',
  },
  'zh-cn': {
    removeItemTip: '确定删除此待办事项？',
    confirm: '确定',
    cancel: '取消',
    newItem: '新建待办',
    save: '保存内容',
    saveTip: '保存成功',
    clearDone: '清除已完成项',
    clearDoneTip: '确定清除已完成项？',
    update: '更新列表',
    updateTip: '更新成功',
  },
}

const i18n = new I18n()

i18n.registry('en', localeMap.en)
i18n.registry('zh-cn', localeMap['zh-cn'])
i18n.setLocal('zh-cn')

export { i18n }

interface DataNode {
  [k: string]: any
}
export interface TreeNode extends DataNode {
  todo: ITodoItem
  children: TreeNode[]
  toJSON?: () => ITodoTree
}

export const findNode = (treeNode: TreeNode[], key: number): TreeNode => {
  if (!(treeNode?.length > 0)) return
  for (const node of treeNode) {
    if (node.key === key) return node
    return findNode(node.children, key)
  }
}

export const appendNode = (container: TreeNode[], node: TreeNode) => {
  if (Array.isArray(container)) {
    container.push(node)
  }
}
export const removeNode = (container: TreeNode[], node: TreeNode) => {
  if (Array.isArray(container)) {
    container.splice(container.indexOf(node), 1)
  }
}
export const clearDoneNode = (treeNode: TreeNode[], isRemove: (node: TreeNode) => boolean) => {
  if (!(treeNode?.length > 0)) return []
  const nextTree: TreeNode[] = []
  for (const node of treeNode) {
    if (isRemove(node)) {
      continue
    }
    nextTree.push(node)
    node.children = clearDoneNode(node.children, isRemove)
  }
  return nextTree
}



export const treeDrop = <T extends DataNode>(tree: T[], handle: (newTree: T[]) => void) => info => {
  const dropKey = info.node.key
  const dragKey = info.dragNode.key
  const dropPos = info.node.pos.split('-')
  const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1])

  const loop = (data, key, callback) => {
    for (let i = 0; i < data.length; i++) {
      if (data[i].key === key) {
        return callback(data[i], i, data)
      }
      if (data[i].children) {
        loop(data[i].children, key, callback)
      }
    }
  }
  const data = [...tree]

  // Find dragObject
  let dragObj
  loop(data, dragKey, (item, index, arr) => {
    arr.splice(index, 1)
    dragObj = item
  })

  if (!info.dropToGap) {
    // Drop on the content
    loop(data, dropKey, item => {
      item.children = item.children || []
      // where to insert 示例添加到头部，可以是随意位置
      item.children.unshift(dragObj)
    })
  } else if (
    (info.node.props.children || []).length > 0 && // Has children
    info.node.props.expanded && // Is expanded
    dropPosition === 1 // On the bottom gap
  ) {
    loop(data, dropKey, item => {
      item.children = item.children || []
      // where to insert 示例添加到头部，可以是随意位置
      item.children.unshift(dragObj)
      // in previous version, we use item.children.push(dragObj) to insert the
      // item to the tail of the children
    })
  } else {
    let ar
    let i
    loop(data, dropKey, (item, index, arr) => {
      ar = arr
      i = index
    })
    if (dropPosition === -1) {
      ar.splice(i, 0, dragObj)
    } else {
      ar.splice(i + 1, 0, dragObj)
    }
  }

  handle(data)
}

export function getArray<T>(array: T[]) { return (Array.isArray(array) ? array : []) }

const { Text, Title } = Typography

let events: VoidFunction[] = []

export const PageTodoTree = () => {
  const [_, setState] = useState({})
  const forceUpdate = () => setState({})

  const expandKeysRef = useRef<Key[]>([])
  const updateExpandKeys = (keys: Key[], type: 'push' | 'replace' = 'push') => {
    const expandKeys = getArray(expandKeysRef.current)
    expandKeysRef.current = Array.from(
      new Set(type === 'push' ? [...expandKeys, ...keys] : keys)
    )
    forceUpdate()
  }

  const treeRef = useRef<TreeNode[]>([])

  const updateTree = () => {
    const data = treeRef.current
    if (Array.isArray(data)) {
      treeRef.current = data.slice()
    }
    forceUpdate()
    events.forEach(l => l())
  }

  const loadSource = async () => {
    const todo = localStorage.getItem(KEY_TODO_TREE)
    if (todo) {
      const val: IStoreTodoTree = JSON.parse(todo)
      treeRef.current = getArray(val.tree)
      expandKeysRef.current = getArray(val.expandKeys)
      forceUpdate()
    }
  }

  useEffect(() => {
    loadSource()
  }, [])

  const Item = ({ node }: { node: TreeNode }) => {
    const [_, setState] = useState({})
    useEffect(() => {
      const listener = () => setState({})
      events.push(listener)
      return () => {
        events = events.filter(l => l !== listener)
      }
    }, [])
    const todo = node.todo

    let ops = <></>
    if (todo.done) {
      ops = (
        <>
          <Button
            size="small"
            type="text"
            icon={<UndoOutlined />}
            onClick={() => {
              todo.done = false
              updateTree()
            }}
          />
        </>
      )
    } else {
      ops = (
        <>
          <Select
            bordered={false}
            size="small"
            value={todo.level}
            onSelect={level => {
              todo.level = level
              updateTree()
            }}
          >
            <Select.Option value="danger">P0</Select.Option>
            <Select.Option value="warning">P1</Select.Option>
            <Select.Option value="success">P2</Select.Option>
            <Select.Option value="default">P3</Select.Option>
            <Select.Option value="secondary">P4</Select.Option>
          </Select>
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined />}
            onClick={() => {
              createNode(() => node.children)
              updateTree()
              updateExpandKeys([node.key], 'push')
            }}
          />
          <Button
            size="small"
            type="text"
            icon={<CheckOutlined />}
            onClick={() => {
              todo.done = true
              updateTree()
            }}
          />
          <Popconfirm
            placement="topLeft"
            title={i18n.format('removeItemTip')}
            onConfirm={() => {
              todo.pendingDelete = true
              treeRef.current = clearDoneNode(
                treeRef.current,
                node => node.todo.pendingDelete
              )
              updateTree()
            }}
            okText={i18n.format('confirm')}
            cancelText={i18n.format('cancel')}
          >
            <Button size="small" type="text" icon={<DeleteOutlined />} />
          </Popconfirm>
        </>
      )
    }

    return (
      <Space className="todo">
        <Text
          delete={todo.done}
          type={todo.level === 'default' ? null : todo.level}
          disabled={todo.done ? true : false}
          editable={
            todo.done
              ? false
              : {
                tooltip: false,
                onChange: value => {
                  todo.content = value
                  updateTree()
                },
              }
          }
        >
          {todo.content}
        </Text>
        {ops}
      </Space>
    )
  }

  const createNode = (getContainer: () => TreeNode[]) => {
    const key = Date.now()

    const node: TreeNode = {
      key,
      children: [],
      todo: {
        content: 'edit todo.',
        id: key,
        level: 'default',
        done: false,
      },
      toJSON: () => ({
        key: node.key,
        children: node.children as any,
        todo: node.todo,
      }),
    }
    appendNode(getContainer(), node)
  }

  const save = async () => {
    const storeVal: IStoreTodoTree = {
      tree: treeRef.current as any,
      expandKeys: expandKeysRef.current,
    }
    localStorage.setItem(KEY_TODO_TREE, JSON.stringify(storeVal))
  }

  useEffect(() => {
    save()
  }, [treeRef.current])

  const percent = useMemo(
    () => calcProgressV2(treeRef.current as any),
    [treeRef.current]
  )

  return (
    <div className="PageTodoList">
      <div className="layout">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title>Todo List</Title>
          <Progress percent={percent} />
        </Space>
        <Divider />
        <Tree
          titleRender={(node: TreeNode) => <Item node={node} />}
          expandedKeys={expandKeysRef.current}
          onExpand={keys => updateExpandKeys(keys, 'replace')}
          draggable
          blockNode
          onDrop={treeDrop(treeRef.current, data => {
            treeRef.current = data
            updateTree()
          })}
          treeData={treeRef.current}
        />
        <Divider />
        <Space split={<Divider type="vertical" />}>
          <Button
            type="text"
            onClick={() => {
              createNode(() => treeRef.current)
              updateTree()
            }}
          >
            {i18n.format('newItem')}
          </Button>
          <Button
            type="text"
            onClick={async () => {
              await save()
              message.success(i18n.format('saveTip'))
            }}
          >
            {i18n.format('save')}
          </Button>
          <Popconfirm
            placement="top"
            title={i18n.format('clearDoneTip')}
            onConfirm={() => {
              treeRef.current = clearDoneNode(
                treeRef.current,
                node => node.todo.done
              )
              updateTree()
            }}
            okText={i18n.format('confirm')}
            cancelText={i18n.format('cancel')}
          >
            <Button type="text">{i18n.format('clearDone')}</Button>
          </Popconfirm>
          <Button
            type="text"
            onClick={async () => {
              await loadSource()
              message.success(i18n.format('updateTip'))
            }}
          >
            {i18n.format('update')}
          </Button>
        </Space>
      </div>
    </div>
  )
}

import ReactDOM from 'react-dom'

ReactDOM.render(<PageTodoTree />, document.querySelector('#root'))